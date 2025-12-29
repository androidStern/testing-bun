# Transit Isochrones Implementation Plan

## Overview

Implement transit accessibility isochrones for Recovery Jobs users. When a user sets their home location, compute 10-minute, 30-minute, and 60-minute public transit isochrones and store them for job filtering.

## Architecture Flow

```
User taps "Change Home Location"
    ↓
Browser Geolocation API (phone GPS)
    ↓
Save lat/lon to Convex profiles table
    ↓
Trigger Inngest event via scheduler.runAfter(0, ...)
    ↓
Inngest calls Geoapify API (with step-based retries for 202 responses)
    ↓
Store GeoJSON isochrones in Convex
    ↓
Frontend displays city name via Nominatim (free reverse geocoding)
```

---

## File Changes

### 1. Schema Update: `convex/schema.ts`

Add these fields to the existing `profiles` table (around line 156):

```typescript
// Add to existing profiles table definition:
homeLat: v.optional(v.number()),
homeLon: v.optional(v.number()),
isochrones: v.optional(v.object({
  tenMinute: v.any(),      // GeoJSON FeatureCollection
  thirtyMinute: v.any(),
  sixtyMinute: v.any(),
  computedAt: v.number(),
})),
```

**Rationale:**
- `v.any()` for GeoJSON since GeoJSON structures are complex and validating them provides little benefit
- `computedAt` timestamp enables cache invalidation if needed later

---

### 2. New Backend Lib: `convex/lib/geoapify.ts`

Utility functions for Geoapify API interactions (used by Inngest function):

```typescript
import { env } from './env';

const BASE_URL = 'https://api.geoapify.com/v1/isoline';

export type IsochroneResult = {
  done: boolean;
  data?: GeoJSON.FeatureCollection;
  jobId?: string;
};

export type ParsedIsochrones = {
  tenMinute: GeoJSON.FeatureCollection | null;
  thirtyMinute: GeoJSON.FeatureCollection | null;
  sixtyMinute: GeoJSON.FeatureCollection | null;
};

export async function fetchIsochrones(
  lat: number,
  lon: number
): Promise<IsochroneResult> {
  const apiKey = env('GEOAPIFY_API_KEY');
  const url = `${BASE_URL}?lat=${lat}&lon=${lon}&type=time&mode=approximated_transit&range=600,1800,3600&apiKey=${apiKey}`;

  const res = await fetch(url);

  if (res.status === 200) {
    return { done: true, data: await res.json() };
  }

  if (res.status === 202) {
    const body = await res.json();
    return { done: false, jobId: body.properties?.id };
  }

  throw new Error(`Geoapify error: ${res.status} ${await res.text()}`);
}

export async function pollIsochrones(jobId: string): Promise<GeoJSON.FeatureCollection> {
  const apiKey = env('GEOAPIFY_API_KEY');
  const url = `${BASE_URL}?id=${jobId}&apiKey=${apiKey}`;

  const res = await fetch(url);

  if (res.status === 200) {
    return res.json();
  }

  if (res.status === 202) {
    throw new Error('Still pending'); // Inngest retries this step
  }

  throw new Error(`Geoapify poll error: ${res.status}`);
}

export function parseIsochrones(data: GeoJSON.FeatureCollection): ParsedIsochrones {
  const byRange = (range: number): GeoJSON.FeatureCollection | null => {
    const feature = data.features.find(
      (f) => f.properties?.range === range
    );
    return feature
      ? { type: 'FeatureCollection', features: [feature] }
      : null;
  };

  return {
    tenMinute: byRange(600),
    thirtyMinute: byRange(1800),
    sixtyMinute: byRange(3600),
  };
}
```

---

### 3. Environment Variable: `convex/lib/env.ts`

Add `GEOAPIFY_API_KEY` to the existing env schema:

```typescript
// Add to envSchema:
GEOAPIFY_API_KEY: z.string().min(1),
```

---

### 4. Profile Mutations: `convex/profiles.ts`

Add two new functions:

```typescript
import { Id } from './_generated/dataModel';

// New mutation to set home location
export const setHomeLocation = zodMutation({
  args: z.object({
    lat: z.number(),
    lon: z.number(),
  }),
  returns: z.null(),
  handler: async (ctx, { lat, lon }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error('Not authenticated');

    const profile = await ctx.db
      .query('profiles')
      .withIndex('by_workos_user_id', (q) => q.eq('workosUserId', identity.subject))
      .unique();

    if (!profile) throw new Error('Profile not found');

    await ctx.db.patch(profile._id, {
      homeLat: lat,
      homeLon: lon,
      // Clear stale isochrones - will be recomputed
      isochrones: undefined,
    });

    // Trigger isochrone computation via Inngest
    await ctx.scheduler.runAfter(0, internal.isochrones.triggerCompute, {
      profileId: profile._id,
      lat,
      lon,
    });

    return null;
  },
});

// Internal mutation called by Inngest to save computed isochrones
export const saveIsochrones = internalMutation({
  args: {
    profileId: v.id('profiles'),
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

---

### 5. Inngest Event Schema: `convex/inngest/client.ts`

Add new event type to the existing Events type:

```typescript
// Add to Events type:
'isochrones/compute': {
  data: {
    profileId: string; // Convex ID serialized
    lat: number;
    lon: number;
  };
};
```

---

### 6. New Inngest Function: `convex/inngest/computeIsochrones.ts`

```typescript
import { inngest } from './client';
import { internal } from '../_generated/api';
import { fetchIsochrones, pollIsochrones, parseIsochrones } from '../lib/geoapify';
import type { Id } from '../_generated/dataModel';

export const computeIsochrones = inngest.createFunction(
  {
    id: 'compute-isochrones',
    concurrency: { limit: 5 }, // Matches Geoapify 5 req/sec limit
    retries: 10,
  },
  { event: 'isochrones/compute' },
  async ({ event, step, ctx }) => {
    const { profileId, lat, lon } = event.data;
    const convex = ctx.convex;

    // Step 1: Initial fetch (may return immediately or async job)
    const initial = await step.run('fetch-isochrones', async () => {
      return fetchIsochrones(lat, lon);
    });

    let data: GeoJSON.FeatureCollection;

    if (initial.done && initial.data) {
      data = initial.data;
    } else if (initial.jobId) {
      // Step 2: Poll for async result (Inngest retries this step on failure)
      data = await step.run('poll-isochrones', async () => {
        return pollIsochrones(initial.jobId!);
      });
    } else {
      throw new Error('Unexpected Geoapify response: no data or jobId');
    }

    // Step 3: Parse and save to Convex
    const isochrones = parseIsochrones(data);

    await step.run('save-isochrones', async () => {
      await convex.runMutation(internal.profiles.saveIsochrones, {
        profileId: profileId as Id<'profiles'>,
        isochrones: {
          ...isochrones,
          computedAt: Date.now(),
        },
      });
    });

    return {
      success: true,
      profileId,
      ranges: {
        tenMinute: !!isochrones.tenMinute,
        thirtyMinute: !!isochrones.thirtyMinute,
        sixtyMinute: !!isochrones.sixtyMinute,
      },
    };
  }
);
```

---

### 7. Inngest Trigger Action: `convex/isochrones.ts`

New file to bridge from Convex scheduler to Inngest:

```typescript
'use node';

import { internalAction } from './_generated/server';
import { v } from 'convex/values';
import { inngest } from './inngest/client';

export const triggerCompute = internalAction({
  args: {
    profileId: v.id('profiles'),
    lat: v.number(),
    lon: v.number(),
  },
  returns: v.null(),
  handler: async (_ctx, { profileId, lat, lon }) => {
    await inngest.send({
      name: 'isochrones/compute',
      data: {
        profileId: profileId.toString(),
        lat,
        lon,
      },
    });
    return null;
  },
});
```

---

### 8. Register Inngest Function: `convex/inngest/handler.ts`

Add `computeIsochrones` to the functions array:

```typescript
import { computeIsochrones } from './computeIsochrones';

// In createInngestHandler, add to functions array:
functions: [
  processJobSubmission,
  processApplication,
  computeIsochrones, // Add this
],
```

---

### 9. Frontend Geo Utilities: `src/lib/geo.ts`

```typescript
/**
 * Get user's current location via browser Geolocation API
 * Works best on mobile devices with GPS
 */
export function getUserLocation(): Promise<{ lat: number; lon: number }> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation not supported'));
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
        reject(new Error(getGeolocationErrorMessage(error)));
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000, // Cache for 1 minute
      }
    );
  });
}

function getGeolocationErrorMessage(error: GeolocationPositionError): string {
  switch (error.code) {
    case error.PERMISSION_DENIED:
      return 'Location permission denied. Please enable location access in your browser settings.';
    case error.POSITION_UNAVAILABLE:
      return 'Location unavailable. Please try again.';
    case error.TIMEOUT:
      return 'Location request timed out. Please try again.';
    default:
      return 'Could not get your location.';
  }
}

/**
 * Reverse geocode coordinates to city name using Nominatim (free, no API key)
 */
export async function getCityFromCoords(
  lat: number,
  lon: number
): Promise<string> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`,
      {
        headers: {
          'User-Agent': 'RecoveryJobs/1.0', // Required by Nominatim
        },
      }
    );

    if (!res.ok) {
      return 'Unknown location';
    }

    const data = await res.json();
    const address = data.address;

    // Try different address components in order of preference
    return (
      address?.city ||
      address?.town ||
      address?.village ||
      address?.municipality ||
      address?.county ||
      address?.state ||
      'Unknown location'
    );
  } catch {
    return 'Unknown location';
  }
}
```

---

### 10. HomeLocation Component: `src/components/HomeLocation.tsx`

```typescript
import { useMutation, useQuery } from '@tanstack/react-query';
import { useConvexMutation, convexQuery } from '@convex-dev/react-query';
import { api } from '@/convex/_generated/api';
import { getUserLocation, getCityFromCoords } from '@/lib/geo';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { MapPin, Loader2, RefreshCw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface HomeLocationProps {
  workosUserId: string;
}

export function HomeLocation({ workosUserId }: HomeLocationProps) {
  const { toast } = useToast();
  const [city, setCity] = useState<string | null>(null);
  const [cityLoading, setCityLoading] = useState(false);

  const { data: profile } = useQuery(
    convexQuery(api.profiles.getByWorkosUserId, { workosUserId })
  );

  const { mutate: updateLocation, isPending } = useMutation({
    mutationFn: useConvexMutation(api.profiles.setHomeLocation),
    onSuccess: () => {
      toast({
        title: 'Location updated',
        description: 'Computing transit accessibility...',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Fetch city name when lat/lon changes
  useEffect(() => {
    if (profile?.homeLat != null && profile?.homeLon != null) {
      setCityLoading(true);
      getCityFromCoords(profile.homeLat, profile.homeLon)
        .then(setCity)
        .finally(() => setCityLoading(false));
    } else {
      setCity(null);
    }
  }, [profile?.homeLat, profile?.homeLon]);

  async function handleChangeLocation() {
    try {
      const { lat, lon } = await getUserLocation();
      updateLocation({ lat, lon });
    } catch (error) {
      toast({
        title: 'Location error',
        description: error instanceof Error ? error.message : 'Could not get location',
        variant: 'destructive',
      });
    }
  }

  const hasLocation = profile?.homeLat != null && profile?.homeLon != null;
  const hasIsochrones = profile?.isochrones != null;

  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-2 text-sm">
        <MapPin className="h-4 w-4 text-muted-foreground" />
        {cityLoading ? (
          <span className="text-muted-foreground">Loading...</span>
        ) : city ? (
          <span>{city}</span>
        ) : (
          <span className="text-muted-foreground">No location set</span>
        )}
      </div>

      {hasLocation && !hasIsochrones && (
        <span className="text-xs text-muted-foreground">
          (computing transit zones...)
        </span>
      )}

      <Button
        variant="outline"
        size="sm"
        onClick={handleChangeLocation}
        disabled={isPending}
      >
        {isPending ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Locating...
          </>
        ) : hasLocation ? (
          <>
            <RefreshCw className="mr-2 h-4 w-4" />
            Update
          </>
        ) : (
          'Set Home Location'
        )}
      </Button>
    </div>
  );
}
```

---

## Implementation Order

1. **Schema & Environment** (5 min)
   - Add fields to `convex/schema.ts`
   - Add `GEOAPIFY_API_KEY` to `convex/lib/env.ts`

2. **Backend Utilities** (10 min)
   - Create `convex/lib/geoapify.ts`

3. **Inngest Integration** (15 min)
   - Add event type to `convex/inngest/client.ts`
   - Create `convex/inngest/computeIsochrones.ts`
   - Create `convex/isochrones.ts` (trigger action)
   - Register function in `convex/inngest/handler.ts`

4. **Profile Mutations** (10 min)
   - Add `setHomeLocation` mutation to `convex/profiles.ts`
   - Add `saveIsochrones` internal mutation

5. **Frontend** (15 min)
   - Create `src/lib/geo.ts`
   - Create `src/components/HomeLocation.tsx`

6. **Integration** (5 min)
   - Add `<HomeLocation />` to profile page or settings

---

## Environment Variables Required

```bash
# Add to Convex environment
GEOAPIFY_API_KEY=your_geoapify_api_key
```

---

## Geoapify API Details

### Endpoint
```
GET https://api.geoapify.com/v1/isoline
```

### Parameters Used
| Parameter | Value | Description |
|-----------|-------|-------------|
| `lat` | User's latitude | From browser geolocation |
| `lon` | User's longitude | From browser geolocation |
| `type` | `time` | Time-based isochrones |
| `mode` | `approximated_transit` | Global coverage (no GTFS needed) |
| `range` | `600,1800,3600` | 10, 30, 60 minutes in seconds |

### Response Handling
- **200:** GeoJSON ready immediately
- **202:** Async calculation, poll with returned `jobId`

### Credit Usage
- 10 min = 2 credits
- 30 min = 6 credits
- 60 min = 12 credits
- **Total per user: 20 credits**
- **Free tier: 3,000 credits/day = ~150 users/day**

---

## Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| `approximated_transit` mode | Global coverage without GTFS data |
| Single API call | `range=600,1800,3600` returns all three in one request |
| Inngest step-based polling | 202 polling without holding server resources |
| Nominatim for reverse geocoding | Free, no API key, frontend-only |
| Store lat/lon, not city | City derived on frontend, avoids backend geocoding calls |
| Concurrency limit of 5 | Matches Geoapify free tier rate limit |
| Clear isochrones on location update | Ensures fresh computation, no stale data |

---

## Testing Checklist

1. [ ] Set `GEOAPIFY_API_KEY` in Convex dashboard
2. [ ] Click "Set Home Location" on mobile device
3. [ ] Verify lat/lon saved to profiles table
4. [ ] Check Inngest dashboard for `compute-isochrones` function run
5. [ ] Verify isochrones GeoJSON stored in profile
6. [ ] Confirm city name displays correctly
7. [ ] Test location update (should clear and recompute isochrones)
8. [ ] Test error handling (permission denied, timeout)

---

## Accuracy Notes

- **Phone GPS:** 3-10 meters (street level)
- **Desktop/laptop:** 100m - several km (WiFi/IP based)
- **Geoapify transit data:** Approximated, not real-time schedules. Good for accessibility analysis, not navigation.

---

## Future Enhancements (Not in Scope)

- Visualize isochrones on a map
- Filter jobs by transit accessibility
- Cache isochrones for unchanged locations
- Support manual address entry (geocoding)
