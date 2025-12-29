# Transit Isochrones Implementation Plan

## Summary

This plan adds transit accessibility isochrones to user profiles. When a user sets their home location via GPS, we compute 10/30/60-minute public transit isochrones via Geoapify and store them for job filtering.

## Architecture Flow

```
User taps "Change Home Location"
    ↓
Browser Geolocation API (phone GPS)
    ↓
Frontend calls setHomeLocation mutation
    ↓
Mutation saves lat/lon, triggers sendIsochronesComputeEvent action
    ↓
Action sends "isochrones/compute" event to Inngest
    ↓
Inngest function calls Geoapify API (handles 202 polling with retries)
    ↓
Inngest calls saveIsochrones internal mutation
    ↓
GeoJSON isochrones stored in Convex profiles table
    ↓
Frontend displays city name via Nominatim reverse geocoding
```

---

## Implementation Steps

### 1. Update Schema (`convex/schema.ts`)

Add new fields to the `profiles` table:

```typescript
// Inside profiles: defineTable({...})
homeLat: v.optional(v.float64()),
homeLon: v.optional(v.float64()),
isochrones: v.optional(v.object({
  tenMinute: v.any(),      // GeoJSON FeatureCollection
  thirtyMinute: v.any(),
  sixtyMinute: v.any(),
  computedAt: v.number(),
})),
```

**Why `v.any()` for GeoJSON?** Convex doesn't have native GeoJSON validators. The structure is complex (FeatureCollection → features[] → geometry → coordinates[][][]). Using `v.any()` is acceptable since:
- Data is only written by our Inngest function (trusted source)
- We validate structure in the Inngest function before saving

---

### 2. Add Inngest Event Type (`convex/inngest/client.ts`)

Add new event type to the `Events` type:

```typescript
type IsochronesComputeEvent = {
  name: 'isochrones/compute';
  data: {
    profileId: string;
    lat: number;
    lon: number;
  };
};

// Add to Events type:
type Events = {
  // ... existing events
  'isochrones/compute': IsochronesComputeEvent;
};

// Export the type
export type { IsochronesComputeEvent };
```

---

### 3. Create Event Sender Action (`convex/inngestNode.ts`)

Add action to send the isochrones compute event:

```typescript
export const sendIsochronesComputeEvent = internalAction({
  args: {
    profileId: v.string(),
    lat: v.number(),
    lon: v.number(),
  },
  handler: async (_ctx, args) => {
    const { inngest } = await import("./inngest");
    await inngest.send({
      name: "isochrones/compute",
      data: {
        profileId: args.profileId,
        lat: args.lat,
        lon: args.lon,
      },
    });
  },
});
```

---

### 4. Create Profile Mutations (`convex/profiles.ts`)

**4a. Add `setHomeLocation` mutation:**

```typescript
export const setHomeLocation = mutation({
  args: { lat: v.number(), lon: v.number() },
  returns: v.null(),
  handler: async (ctx, { lat, lon }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_workos_user_id", (q) =>
        q.eq("workosUserId", identity.subject)
      )
      .first();

    if (!profile) throw new Error("Profile not found");

    await ctx.db.patch(profile._id, {
      homeLat: lat,
      homeLon: lon,
      updatedAt: Date.now(),
    });

    // Trigger isochrone computation via Inngest
    await ctx.scheduler.runAfter(0, internal.inngestNode.sendIsochronesComputeEvent, {
      profileId: profile._id,
      lat,
      lon,
    });

    return null;
  },
});
```

**4b. Add `saveIsochrones` internal mutation:**

```typescript
export const saveIsochrones = internalMutation({
  args: {
    profileId: v.id("profiles"),
    isochrones: v.object({
      tenMinute: v.any(),
      thirtyMinute: v.any(),
      sixtyMinute: v.any(),
      computedAt: v.number(),
    }),
  },
  returns: v.null(),
  handler: async (ctx, { profileId, isochrones }) => {
    await ctx.db.patch(profileId, { isochrones });
    return null;
  },
});
```

**4c. Update `profileDocValidator` to include new fields:**

```typescript
const profileDocValidator = v.object({
  // ... existing fields
  homeLat: v.optional(v.float64()),
  homeLon: v.optional(v.float64()),
  isochrones: v.optional(v.object({
    tenMinute: v.any(),
    thirtyMinute: v.any(),
    sixtyMinute: v.any(),
    computedAt: v.number(),
  })),
});
```

---

### 5. Create Inngest Function (`convex/inngest/computeIsochrones.ts`)

```typescript
import { inngest } from './client';
import { internal } from '../_generated/api';
import type { ActionCtx } from '../_generated/server';
import type { Id } from '../_generated/dataModel';

const GEOAPIFY_API_KEY = process.env.GEOAPIFY_API_KEY!;
const BASE_URL = "https://api.geoapify.com/v1/isoline";

interface HandlerArgs {
  event: { data: { profileId: string; lat: number; lon: number } };
  step: {
    run: <T>(name: string, fn: () => Promise<T>) => Promise<T>;
  };
  convex: ActionCtx;
}

export const computeIsochrones = inngest.createFunction(
  {
    id: 'compute-isochrones',
    concurrency: { limit: 5 }, // Match Geoapify rate limit
    retries: 10,
  },
  { event: 'isochrones/compute' },
  async (args): Promise<{ success: boolean }> => {
    const { event, step, convex } = args as unknown as HandlerArgs;
    const { profileId, lat, lon } = event.data;

    const url = `${BASE_URL}?lat=${lat}&lon=${lon}&type=time&mode=approximated_transit&range=600,1800,3600&apiKey=${GEOAPIFY_API_KEY}`;

    // Step 1: Initial fetch (may return 200 with data or 202 with job ID)
    const initial = await step.run('fetch-isochrones', async () => {
      const res = await fetch(url);

      if (res.status === 200) {
        return { done: true, data: await res.json() };
      }

      if (res.status === 202) {
        const body = await res.json();
        return { done: false, jobId: body.properties?.id };
      }

      throw new Error(`Geoapify error: ${res.status}`);
    });

    let data: unknown;

    if (initial.done) {
      data = initial.data;
    } else {
      // Step 2: Poll for result (Inngest retries this step automatically)
      data = await step.run('poll-isochrones', async () => {
        const pollUrl = `${BASE_URL}?id=${initial.jobId}&apiKey=${GEOAPIFY_API_KEY}`;
        const res = await fetch(pollUrl);

        if (res.status === 200) {
          return res.json();
        }

        if (res.status === 202) {
          // Still pending - throw to trigger Inngest retry
          throw new Error("Isochrone calculation still pending");
        }

        throw new Error(`Geoapify poll error: ${res.status}`);
      });
    }

    // Step 3: Parse and save isochrones
    const isochrones = parseIsochrones(data);

    await step.run('save-isochrones', async () => {
      await convex.runMutation(internal.profiles.saveIsochrones, {
        profileId: profileId as Id<"profiles">,
        isochrones: {
          ...isochrones,
          computedAt: Date.now(),
        },
      });
    });

    return { success: true };
  }
);

function parseIsochrones(data: unknown): {
  tenMinute: unknown;
  thirtyMinute: unknown;
  sixtyMinute: unknown;
} {
  const geoJson = data as { features: Array<{ properties?: { range?: number } }> };

  const byRange = (rangeSeconds: number) => {
    const feature = geoJson.features.find(
      (f) => f.properties?.range === rangeSeconds
    );
    return feature ? { type: "FeatureCollection", features: [feature] } : null;
  };

  return {
    tenMinute: byRange(600),
    thirtyMinute: byRange(1800),
    sixtyMinute: byRange(3600),
  };
}
```

---

### 6. Register Inngest Function

**6a. Export from `convex/inngest/index.ts`:**

```typescript
export { inngest } from './client';
export type { SlackApprovalClickedEvent, JobSubmittedEvent, JobFirstApplicantEvent, IsochronesComputeEvent, Events } from './client';
export { processJobSubmission } from './processJob';
export { processApplication } from './processApplication';
export { computeIsochrones } from './computeIsochrones';
```

**6b. Add to handler in `convex/inngest/handler.ts`:**

```typescript
import { inngest, processApplication, processJobSubmission, computeIsochrones } from "./index";

// ...

const handler = new InngestCommHandler<[Request, ActionCtx], Response>({
  // ...
  functions: [processJobSubmission, processApplication, computeIsochrones],
  // ...
});
```

---

### 7. Create Frontend Geo Utilities (`src/lib/geo.ts`)

```typescript
/**
 * Get city name from coordinates using Nominatim (free, no API key)
 */
export async function getCityFromCoords(
  lat: number,
  lon: number
): Promise<string> {
  const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`;

  const res = await fetch(url, {
    headers: {
      // Nominatim requires a User-Agent
      'User-Agent': 'RecoveryJobs/1.0'
    }
  });

  if (!res.ok) {
    throw new Error(`Nominatim error: ${res.status}`);
  }

  const data = await res.json();

  return (
    data.address?.city ||
    data.address?.town ||
    data.address?.village ||
    data.address?.county ||
    "Unknown location"
  );
}

/**
 * Get user's current location via browser Geolocation API
 */
export function getUserLocation(): Promise<{ lat: number; lon: number }> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Geolocation not supported"));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          lat: position.coords.latitude,
          lon: position.coords.longitude,
        });
      },
      (error) => {
        let message = "Location error";
        switch (error.code) {
          case error.PERMISSION_DENIED:
            message = "Location permission denied";
            break;
          case error.POSITION_UNAVAILABLE:
            message = "Location unavailable";
            break;
          case error.TIMEOUT:
            message = "Location request timed out";
            break;
        }
        reject(new Error(message));
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000, // Cache for 1 minute
      }
    );
  });
}
```

---

### 8. Create HomeLocation Component (`src/components/HomeLocation.tsx`)

```typescript
import { convexQuery, useConvexMutation } from '@convex-dev/react-query';
import { useMutation, useQuery } from '@tanstack/react-query';
import { MapPin } from 'lucide-react';
import { useEffect, useState } from 'react';

import { api } from '../../convex/_generated/api';
import { useToast } from '@/hooks/use-toast';
import { getCityFromCoords, getUserLocation } from '@/lib/geo';
import { Button } from '@/components/ui/button';

interface HomeLocationProps {
  workosUserId: string;
}

export function HomeLocation({ workosUserId }: HomeLocationProps) {
  const { toast } = useToast();
  const [city, setCity] = useState<string | null>(null);
  const [isLocating, setIsLocating] = useState(false);

  const { data: profile } = useQuery(
    convexQuery(api.profiles.getByWorkosUserId, { workosUserId })
  );

  const { mutate: setHomeLocation } = useMutation({
    mutationFn: useConvexMutation(api.profiles.setHomeLocation),
    onSuccess: () => {
      toast({
        title: 'Location updated',
        description: 'Your home location has been saved. Transit zones are being computed.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update location',
        variant: 'destructive',
      });
    },
  });

  // Fetch city name when profile has coordinates
  useEffect(() => {
    if (profile?.homeLat && profile?.homeLon) {
      getCityFromCoords(profile.homeLat, profile.homeLon)
        .then(setCity)
        .catch(() => setCity("Unknown"));
    }
  }, [profile?.homeLat, profile?.homeLon]);

  const handleChangeLocation = async () => {
    setIsLocating(true);
    try {
      const { lat, lon } = await getUserLocation();
      setHomeLocation({ lat, lon });

      // Optimistically update city display
      const newCity = await getCityFromCoords(lat, lon);
      setCity(newCity);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not get location';
      toast({
        title: 'Location Error',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setIsLocating(false);
    }
  };

  const hasIsochrones = Boolean(profile?.isochrones?.computedAt);

  return (
    <div className="flex items-center gap-3 p-4 border border-border rounded-lg bg-card">
      <MapPin className="h-5 w-5 text-muted-foreground shrink-0" />

      <div className="flex-1 min-w-0">
        {city ? (
          <div>
            <p className="font-medium text-foreground truncate">{city}</p>
            {hasIsochrones && (
              <p className="text-xs text-muted-foreground">
                Transit zones computed
              </p>
            )}
            {profile?.homeLat && !hasIsochrones && (
              <p className="text-xs text-muted-foreground">
                Computing transit zones...
              </p>
            )}
          </div>
        ) : (
          <p className="text-muted-foreground">No home location set</p>
        )}
      </div>

      <Button
        variant="outline"
        size="sm"
        onClick={handleChangeLocation}
        disabled={isLocating}
      >
        {isLocating ? 'Locating...' : city ? 'Update' : 'Set Location'}
      </Button>
    </div>
  );
}
```

---

### 9. Environment Variables

Add to `.env`:

```bash
GEOAPIFY_API_KEY=your_api_key_here
```

Add to Convex environment (via dashboard or CLI):

```bash
npx convex env set GEOAPIFY_API_KEY your_api_key_here
```

---

## Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `convex/schema.ts` | Modify | Add `homeLat`, `homeLon`, `isochrones` to profiles |
| `convex/profiles.ts` | Modify | Add `setHomeLocation`, `saveIsochrones`, update validators |
| `convex/inngest/client.ts` | Modify | Add `IsochronesComputeEvent` type |
| `convex/inngestNode.ts` | Modify | Add `sendIsochronesComputeEvent` action |
| `convex/inngest/computeIsochrones.ts` | Create | Inngest function for Geoapify API |
| `convex/inngest/index.ts` | Modify | Export `computeIsochrones` function |
| `convex/inngest/handler.ts` | Modify | Register `computeIsochrones` in functions array |
| `src/lib/geo.ts` | Create | Frontend geolocation utilities |
| `src/components/HomeLocation.tsx` | Create | Location picker component |

---

## Testing Checklist

1. [ ] Set `GEOAPIFY_API_KEY` in Convex env
2. [ ] Deploy schema changes: `npx convex dev`
3. [ ] Click "Set Location" on mobile device
4. [ ] Verify lat/lon saved to Convex profiles table
5. [ ] Check Inngest dashboard for `compute-isochrones` function run
6. [ ] Verify isochrones GeoJSON stored in profile
7. [ ] Confirm city name displays via Nominatim

---

## Cost Analysis

- **Geoapify free tier:** 3,000 credits/day
- **Per user:** 20 credits (10min=2 + 30min=6 + 60min=12)
- **Daily capacity:** ~150 users on free tier
- **Upgrade path:** $49/mo for 50,000 credits = 2,500 users/day

---

## Notes

1. **`approximated_transit` mode** - Uses estimated transit times, not real GTFS schedules. Good for accessibility analysis, works globally.

2. **Polling pattern** - Geoapify may return 202 for slow calculations. Inngest step retries handle this automatically - the step throws, Inngest retries, jobId is preserved from the first step.

3. **Concurrency limit of 5** - Matches Geoapify's 5 req/sec rate limit.

4. **Desktop accuracy** - Browser geolocation on desktop uses WiFi/IP, which can be 100m-several km inaccurate. Consider adding a manual address input option in the future.
