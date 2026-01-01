# LLM Job Matcher Implementation Plan

## Overview

Build an AI-powered job matching feature using the Convex Agent component. Users can search for jobs using natural language, with an LLM agent that understands their resume, preferences, and commute constraints. The system is durable (survives page refresh), enforces one active search per user, and scales from a simple "Find Jobs" button to a full chat interface.

## Architecture

```
User has job preferences stored in `jobPreferences` table
User has resume in `resumes` table
User has isochrones in `profiles` table (optional)
                    ↓
User visits /jobs page
                    ↓
Check for existing active search thread
  - If exists: resume that thread, show previous results
  - If not: show "Find Jobs For Me" button with editable prompt
                    ↓
User submits prompt (default: "Find jobs matching my resume and preferences")
                    ↓
Create new thread + jobSearch record
                    ↓
Agent runs with secure, context-aware tools:
  - getMyResume() — implicitly fetches authenticated user's resume
  - getMyJobPreferences() — implicitly fetches user's preferences
  - searchJobs(query, filters) — searches Typesense with implicit geo-filtering
                    ↓
Messages + stream deltas saved to Convex DB
                    ↓
Frontend subscribes via useUIMessages hook — survives refresh
                    ↓
Agent returns structured job matches
                    ↓
Frontend parses into job cards with match explanations
```

## Security Model: Implicit User Context

**Key principle**: Tools are context-aware, but the LLM is context-blind to sensitive data.

- Tool handlers receive `ctx` with authenticated `userId`
- All user-specific data (resume, preferences, isochrones) is fetched implicitly by handlers
- LLM only sees sanitized results — never raw coordinates, isochrone polygons, or internal IDs
- LLM cannot impersonate other users — `userId` comes from auth context, not tool parameters

---

## Key Technical Decisions

This plan incorporates the following verified patterns from the Convex Agent documentation and existing codebase:

1. **Agent `languageModel` property** — The Agent constructor uses `languageModel`, not `chat`, for the AI model
2. **`streamText` for real-time updates** — Use `streamText` with `saveStreamDeltas: true` for streaming; `generateText` does NOT support `saveStreamDeltas`
3. **File splitting for Node.js** — Actions using AI SDK require `"use node"` directive, which applies to the whole file. Queries/mutations must be in a separate file
4. **Internal query naming** — Internal queries use `getByWorkosUserIdInternal` suffix to distinguish from public versions
5. **Shift filter OR logic** — Shift preferences use OR logic in Typesense (`shift_morning:=true || shift_afternoon:=true`), not AND
6. **Coordinate order** — Typesense stores `[lat, lng]`, but Turf.js/GeoJSON uses `[lng, lat]` — conversion is handled in `geoFilter.ts`
7. **Groq SDK env vars** — Groq SDK automatically reads `GROQ_API_KEY` from environment; no explicit config needed

---

## Phase 1: Dependencies & Component Setup

### 1.1 Install Dependencies

```bash
bun add @convex-dev/agent @ai-sdk/groq @turf/boolean-point-in-polygon @turf/helpers
```

### 1.2 Create Convex Config

**File: `convex/convex.config.ts`**

```typescript
import { defineApp } from "convex/server";
import agent from "@convex-dev/agent/convex.config";

const app = defineApp();
app.use(agent);

export default app;
```

---

## Phase 2: Schema Updates

### 2.1 Add New Tables

**File: `convex/schema.ts`** (additions to existing schema)

```typescript
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

// Add these tables to the existing schema definition:

// Job search preferences - maps to Typesense facets
jobPreferences: defineTable({
  workosUserId: v.string(),
  
  // Commute preferences
  maxCommuteMinutes: v.optional(v.union(v.literal(10), v.literal(30), v.literal(60))),
  requirePublicTransit: v.optional(v.boolean()),
  
  // Second-chance employer preferences
  preferSecondChance: v.optional(v.boolean()),
  requireSecondChance: v.optional(v.boolean()),
  
  // Shift preferences
  shiftMorning: v.optional(v.boolean()),
  shiftAfternoon: v.optional(v.boolean()),
  shiftEvening: v.optional(v.boolean()),
  shiftOvernight: v.optional(v.boolean()),
  shiftFlexible: v.optional(v.boolean()),
  
  // Transit accessibility requirements
  requireBusAccessible: v.optional(v.boolean()),
  requireRailAccessible: v.optional(v.boolean()),
  
  // Job type preferences
  preferUrgent: v.optional(v.boolean()),
  preferEasyApply: v.optional(v.boolean()),
  
  updatedAt: v.number(),
}).index('by_workos_user_id', ['workosUserId']),

// Track active job searches (one per user)
jobSearches: defineTable({
  workosUserId: v.string(),
  threadId: v.string(),
  status: v.union(v.literal('active'), v.literal('completed'), v.literal('cancelled')),
  initialPrompt: v.string(),
  startedAt: v.number(),
  completedAt: v.optional(v.number()),
}).index('by_workos_user_id', ['workosUserId'])
  .index('by_workos_user_id_status', ['workosUserId', 'status'])
  .index('by_thread_id', ['threadId']),
```

---

## Phase 3: Job Preferences CRUD

**File: `convex/jobPreferences.ts`**

```typescript
import { v } from "convex/values";
import { mutation, query, internalQuery } from "./_generated/server";

// Public query - get current user's preferences
export const get = query({
  args: {},
  returns: v.union(
    v.object({
      _id: v.id("jobPreferences"),
      workosUserId: v.string(),
      maxCommuteMinutes: v.optional(v.union(v.literal(10), v.literal(30), v.literal(60))),
      requirePublicTransit: v.optional(v.boolean()),
      preferSecondChance: v.optional(v.boolean()),
      requireSecondChance: v.optional(v.boolean()),
      shiftMorning: v.optional(v.boolean()),
      shiftAfternoon: v.optional(v.boolean()),
      shiftEvening: v.optional(v.boolean()),
      shiftOvernight: v.optional(v.boolean()),
      shiftFlexible: v.optional(v.boolean()),
      requireBusAccessible: v.optional(v.boolean()),
      requireRailAccessible: v.optional(v.boolean()),
      preferUrgent: v.optional(v.boolean()),
      preferEasyApply: v.optional(v.boolean()),
      updatedAt: v.number(),
    }),
    v.null()
  ),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    return await ctx.db
      .query("jobPreferences")
      .withIndex("by_workos_user_id", (q) => q.eq("workosUserId", identity.subject))
      .unique();
  },
});

// Internal query for agent tools
export const getByWorkosUserIdInternal = internalQuery({
  args: { workosUserId: v.string() },
  returns: v.any(),
  handler: async (ctx, { workosUserId }) => {
    return await ctx.db
      .query("jobPreferences")
      .withIndex("by_workos_user_id", (q) => q.eq("workosUserId", workosUserId))
      .unique();
  },
});

// Upsert preferences
export const upsert = mutation({
  args: {
    maxCommuteMinutes: v.optional(v.union(v.literal(10), v.literal(30), v.literal(60))),
    requirePublicTransit: v.optional(v.boolean()),
    preferSecondChance: v.optional(v.boolean()),
    requireSecondChance: v.optional(v.boolean()),
    shiftMorning: v.optional(v.boolean()),
    shiftAfternoon: v.optional(v.boolean()),
    shiftEvening: v.optional(v.boolean()),
    shiftOvernight: v.optional(v.boolean()),
    shiftFlexible: v.optional(v.boolean()),
    requireBusAccessible: v.optional(v.boolean()),
    requireRailAccessible: v.optional(v.boolean()),
    preferUrgent: v.optional(v.boolean()),
    preferEasyApply: v.optional(v.boolean()),
  },
  returns: v.id("jobPreferences"),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const existing = await ctx.db
      .query("jobPreferences")
      .withIndex("by_workos_user_id", (q) => q.eq("workosUserId", identity.subject))
      .unique();

    const data = {
      ...args,
      workosUserId: identity.subject,
      updatedAt: Date.now(),
    };

    if (existing) {
      await ctx.db.patch(existing._id, data);
      return existing._id;
    }

    return await ctx.db.insert("jobPreferences", data);
  },
});
```

---

## Phase 4: Geo-Filtering Utilities

**File: `convex/lib/geoFilter.ts`**

```typescript
import booleanPointInPolygon from "@turf/boolean-point-in-polygon";
import { point } from "@turf/helpers";

export interface JobWithLocation {
  id: string;
  location?: [number, number]; // [lat, lng] from Typesense
  [key: string]: unknown;
}

export interface IsochroneData {
  tenMinute: GeoJSON.FeatureCollection | null;
  thirtyMinute: GeoJSON.FeatureCollection | null;
  sixtyMinute: GeoJSON.FeatureCollection | null;
  computedAt: number;
}

/**
 * Filter jobs by whether they fall within a user's transit isochrone
 * 
 * @param jobs - Array of jobs with location coordinates
 * @param isochrones - User's pre-computed isochrone polygons
 * @param maxMinutes - Maximum commute time (10, 30, or 60)
 * @returns Jobs that fall within the specified isochrone zone
 */
export function filterByIsochrone<T extends JobWithLocation>(
  jobs: T[],
  isochrones: IsochroneData,
  maxMinutes: 10 | 30 | 60
): T[] {
  // Select the appropriate isochrone polygon
  const polygon =
    maxMinutes === 10
      ? isochrones.tenMinute
      : maxMinutes === 30
        ? isochrones.thirtyMinute
        : isochrones.sixtyMinute;

  if (!polygon || !polygon.features || polygon.features.length === 0) {
    // No isochrone data - return all jobs
    return jobs;
  }

  return jobs.filter((job) => {
    if (!job.location || job.location.length !== 2) {
      // Job has no coordinates - exclude from transit-filtered results
      return false;
    }

    const [lat, lng] = job.location;
    // Turf.js uses [lng, lat] (GeoJSON order), Typesense uses [lat, lng]
    const jobPoint = point([lng, lat]);

    // Check if point is in any of the isochrone features
    return polygon.features.some((feature) => {
      try {
        return booleanPointInPolygon(jobPoint, feature as GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon>);
      } catch {
        return false;
      }
    });
  });
}

/**
 * Check if a single point is within an isochrone
 */
export function isPointInIsochrone(
  lat: number,
  lng: number,
  isochrones: IsochroneData,
  maxMinutes: 10 | 30 | 60
): boolean {
  const polygon =
    maxMinutes === 10
      ? isochrones.tenMinute
      : maxMinutes === 30
        ? isochrones.thirtyMinute
        : isochrones.sixtyMinute;

  if (!polygon || !polygon.features || polygon.features.length === 0) {
    return true; // No isochrone - assume reachable
  }

  const jobPoint = point([lng, lat]);

  return polygon.features.some((feature) => {
    try {
      return booleanPointInPolygon(jobPoint, feature as GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon>);
    } catch {
      return false;
    }
  });
}
```

---

## Phase 5: Extended Typesense Search

**File: `convex/scrapedJobsSearch.ts`** (replace existing file)

```typescript
"use node";

/**
 * Scraped Jobs Search - Typesense-dependent actions
 *
 * Provides search capabilities including geo-filtering for the job matcher agent.
 */

import Typesense from "typesense";
import { v } from "convex/values";
import { internalAction } from "./_generated/server";
import { adminAction } from "./functions";

function getTypesenseClient() {
  const typesenseUrl = process.env.TYPESENSE_URL;
  const apiKey = process.env.TYPESENSE_API_KEY;

  if (!typesenseUrl) throw new Error("TYPESENSE_URL environment variable is required");
  if (!apiKey) throw new Error("TYPESENSE_API_KEY environment variable is required");

  const url = new URL(typesenseUrl);

  return new Typesense.Client({
    nodes: [
      {
        host: url.hostname,
        port: parseInt(url.port) || 8108,
        protocol: url.protocol.replace(":", "") as "http" | "https",
      },
    ],
    apiKey,
    connectionTimeoutSeconds: 10,
  });
}

// Whitelist of allowed filter keys
const ALLOWED_FILTERS = new Set([
  "source",
  "city",
  "state",
  "second_chance",
  "second_chance_tier",
  "bus_accessible",
  "rail_accessible",
  "shift_morning",
  "shift_afternoon",
  "shift_evening",
  "shift_overnight",
  "shift_flexible",
  "is_urgent",
  "is_easy_apply",
]);

function sanitizeFilterValue(value: string): string {
  return value.replace(/[`\\:=<>&|()[\]]/g, "");
}

function buildFilterString(filters: Record<string, unknown>): string {
  const filterParts: string[] = [];

  for (const [key, value] of Object.entries(filters)) {
    if (!ALLOWED_FILTERS.has(key)) continue;
    if (value === undefined || value === null) continue;

    if (typeof value === "boolean") {
      filterParts.push(`${key}:=${value}`);
    } else if (typeof value === "string" && value !== "") {
      const sanitized = sanitizeFilterValue(value);
      if (sanitized) {
        filterParts.push(`${key}:=\`${sanitized}\``);
      }
    }
  }

  return filterParts.join(" && ");
}

/**
 * Admin search - existing functionality for dashboard
 */
export const search = adminAction({
  args: {
    query: v.optional(v.string()),
    filters: v.optional(
      v.object({
        source: v.optional(v.string()),
        city: v.optional(v.string()),
        state: v.optional(v.string()),
        second_chance_tier: v.optional(v.string()),
        bus_accessible: v.optional(v.boolean()),
        rail_accessible: v.optional(v.boolean()),
        shift_morning: v.optional(v.boolean()),
        shift_afternoon: v.optional(v.boolean()),
        shift_evening: v.optional(v.boolean()),
        shift_overnight: v.optional(v.boolean()),
        shift_flexible: v.optional(v.boolean()),
        is_urgent: v.optional(v.boolean()),
        is_easy_apply: v.optional(v.boolean()),
      })
    ),
    page: v.optional(v.number()),
    perPage: v.optional(v.number()),
  },
  returns: v.any(),
  handler: async (_ctx, args) => {
    const client = getTypesenseClient();

    const filterString = args.filters ? buildFilterString(args.filters) : "";

    const results = await client
      .collections("jobs")
      .documents()
      .search({
        q: args.query || "*",
        query_by: "title,company,description",
        filter_by: filterString || undefined,
        page: args.page || 1,
        per_page: args.perPage || 25,
        facet_by:
          "source,city,state,second_chance_tier,bus_accessible,rail_accessible,shift_morning,shift_afternoon,shift_evening,shift_overnight,shift_flexible,is_urgent,is_easy_apply",
      });

    return results;
  },
});

/**
 * Internal search with geo-filtering for agent tools
 * Returns raw Typesense results for further processing
 */
export const searchWithGeo = internalAction({
  args: {
    query: v.string(),
    filters: v.optional(
      v.object({
        city: v.optional(v.string()),
        state: v.optional(v.string()),
        second_chance: v.optional(v.boolean()),
        second_chance_tier: v.optional(v.string()),
        bus_accessible: v.optional(v.boolean()),
        rail_accessible: v.optional(v.boolean()),
        is_urgent: v.optional(v.boolean()),
        is_easy_apply: v.optional(v.boolean()),
      })
    ),
    // Shift preferences use OR logic - match jobs with ANY of these shifts
    shiftPreferences: v.optional(v.array(v.string())),
    geoFilter: v.optional(
      v.object({
        lat: v.number(),
        lng: v.number(),
        radiusKm: v.number(),
      })
    ),
    limit: v.optional(v.number()),
  },
  returns: v.any(),
  handler: async (_ctx, args) => {
    const client = getTypesenseClient();

    // Build filter parts
    const filterParts: string[] = [];

    // Add facet filters (AND logic)
    if (args.filters) {
      const facetFilter = buildFilterString(args.filters);
      if (facetFilter) {
        filterParts.push(facetFilter);
      }
    }

    // Add shift preferences with OR logic
    // If user prefers morning OR afternoon, we want jobs that have EITHER
    if (args.shiftPreferences && args.shiftPreferences.length > 0) {
      const shiftConditions = args.shiftPreferences
        .map((shift) => `shift_${shift}:=true`)
        .join(" || ");
      filterParts.push(`(${shiftConditions})`);
    }

    // Add geo filter if provided
    if (args.geoFilter) {
      const { lat, lng, radiusKm } = args.geoFilter;
      filterParts.push(`location:(${lat}, ${lng}, ${radiusKm} km)`);
    }

    const results = await client
      .collections("jobs")
      .documents()
      .search({
        q: args.query || "*",
        query_by: "title,company,description",
        filter_by: filterParts.length > 0 ? filterParts.join(" && ") : undefined,
        per_page: args.limit || 50,
        sort_by: args.geoFilter
          ? `location(${args.geoFilter.lat}, ${args.geoFilter.lng}):asc`
          : "posted_at:desc",
      });

    return results;
  },
});
```

---

## Phase 6: Agent Tools

**File: `convex/jobMatcher/tools.ts`**

```typescript
import { createTool } from "@convex-dev/agent";
import { z } from "zod";
import { internal } from "../_generated/api";
import { filterByIsochrone, type IsochroneData } from "../lib/geoFilter";

/**
 * Sanitized resume data returned to the LLM
 */
interface SanitizedResume {
  summary: string | null;
  skills: string | null;
  experience: Array<{
    position: string | null;
    company: string | null;
    description: string | null;
    achievements: string | null;
  }>;
  education: Array<{
    degree: string | null;
    field: string | null;
    institution: string | null;
  }>;
}

/**
 * Sanitized preferences returned to the LLM
 */
interface SanitizedPreferences {
  hasHomeLocation: boolean;
  hasTransitZones: boolean;
  maxCommuteMinutes: number;
  requirePublicTransit: boolean;
  preferSecondChance: boolean;
  requireSecondChance: boolean;
  shiftPreferences: {
    morning?: boolean;
    afternoon?: boolean;
    evening?: boolean;
    overnight?: boolean;
    flexible?: boolean;
  };
  transitRequirements: {
    bus?: boolean;
    rail?: boolean;
  };
}

/**
 * Sanitized job result returned to the LLM
 */
interface SanitizedJob {
  id: string;
  title: string;
  company: string;
  location: string | null;
  description: string | null;
  salary: string | null;
  isSecondChance: boolean;
  secondChanceTier: string | null;
  shifts: string[];
  transitAccessible: boolean;
  busAccessible: boolean;
  railAccessible: boolean;
  isUrgent: boolean;
  isEasyApply: boolean;
  url: string;
}

/**
 * Get the authenticated user's resume
 * 
 * Security: Uses ctx.userId (from auth) - LLM cannot access other users' resumes
 */
export const getMyResume = createTool({
  description:
    "Get your resume including professional summary, skills, work experience, and education. Use this to understand what jobs you're qualified for.",
  args: z.object({}),
  handler: async (ctx): Promise<SanitizedResume | null> => {
    if (!ctx.userId) {
      throw new Error("Not authenticated");
    }

    const resume = await ctx.runQuery(internal.resumes.getByWorkosUserIdInternal, {
      workosUserId: ctx.userId,
    });

    if (!resume) {
      return null;
    }

    // Return sanitized data - no internal IDs, timestamps, or storage refs
    return {
      summary: resume.summary ?? null,
      skills: resume.skills ?? null,
      experience: (resume.workExperience ?? []).map(
        (exp: {
          position?: string;
          company?: string;
          description?: string;
          achievements?: string;
        }) => ({
          position: exp.position ?? null,
          company: exp.company ?? null,
          description: exp.description ?? null,
          achievements: exp.achievements ?? null,
        })
      ),
      education: (resume.education ?? []).map(
        (edu: { degree?: string; field?: string; institution?: string }) => ({
          degree: edu.degree ?? null,
          field: edu.field ?? null,
          institution: edu.institution ?? null,
        })
      ),
    };
  },
});

/**
 * Get the authenticated user's job search preferences
 * 
 * Security: Uses ctx.userId (from auth) - LLM cannot access other users' preferences
 * Note: Returns whether user has isochrones, but NOT the actual isochrone data
 */
export const getMyJobPreferences = createTool({
  description:
    "Get your job search preferences including commute limits, shift preferences, and whether you prefer second-chance employers. Also tells you if you have transit zones set up.",
  args: z.object({}),
  handler: async (ctx): Promise<SanitizedPreferences> => {
    if (!ctx.userId) {
      throw new Error("Not authenticated");
    }

    // Fetch preferences
    const prefs = await ctx.runQuery(internal.jobPreferences.getByUserId, {
      userId: ctx.userId,
    });

    // Fetch profile for location/isochrone status
    const profile = await ctx.runQuery(internal.profiles.getByWorkosUserIdInternal, {
      workosUserId: ctx.userId,
    });

    // Return sanitized preferences - no raw coordinates or isochrone polygons
    return {
      hasHomeLocation: !!(profile?.homeLat && profile?.homeLon),
      hasTransitZones: !!profile?.isochrones,
      maxCommuteMinutes: prefs?.maxCommuteMinutes ?? 30,
      requirePublicTransit: prefs?.requirePublicTransit ?? false,
      preferSecondChance: prefs?.preferSecondChance ?? false,
      requireSecondChance: prefs?.requireSecondChance ?? false,
      shiftPreferences: {
        morning: prefs?.shiftMorning,
        afternoon: prefs?.shiftAfternoon,
        evening: prefs?.shiftEvening,
        overnight: prefs?.shiftOvernight,
        flexible: prefs?.shiftFlexible,
      },
      transitRequirements: {
        bus: prefs?.requireBusAccessible,
        rail: prefs?.requireRailAccessible,
      },
    };
  },
});

/**
 * Search for jobs with automatic geo-filtering based on user's isochrones
 * 
 * Security: 
 * - Uses ctx.userId to fetch user's isochrones (LLM never sees them)
 * - Geo-filtering happens server-side, not in LLM's context
 * - Returns sanitized job data without internal IDs or raw coordinates
 */
export const searchJobs = createTool({
  description: `Search for jobs matching keywords and filters. 
Results are AUTOMATICALLY filtered by your commute zone if you have transit zones set up.
You don't need to worry about location filtering - it happens automatically based on the user's preferences.

Tips:
- Search for job titles, skills, or industries from the user's resume
- Use filters to narrow by shift times or second-chance employers
- Run multiple searches with different keywords to find diverse matches`,
  args: z.object({
    query: z
      .string()
      .describe("Search keywords: job titles, skills, company names, industries"),
    filters: z
      .object({
        second_chance_only: z
          .boolean()
          .optional()
          .describe("Only show second-chance/fair-chance employers"),
        shifts: z
          .array(z.enum(["morning", "afternoon", "evening", "overnight", "flexible"]))
          .optional()
          .describe("Filter by shift availability"),
        city: z.string().optional().describe("Filter by city name"),
        state: z.string().optional().describe("Filter by state (e.g., FL, CA)"),
        bus_accessible: z.boolean().optional().describe("Require bus accessibility"),
        rail_accessible: z.boolean().optional().describe("Require rail accessibility"),
        urgent_only: z.boolean().optional().describe("Only show urgent hiring"),
        easy_apply_only: z.boolean().optional().describe("Only show easy apply jobs"),
      })
      .optional(),
    limit: z
      .number()
      .min(1)
      .max(30)
      .default(15)
      .describe("Number of results to return (max 30)"),
  }),
  handler: async (ctx, args): Promise<SanitizedJob[]> => {
    if (!ctx.userId) {
      throw new Error("Not authenticated");
    }

    // Fetch user context (LLM never sees this)
    const [prefs, profile] = await Promise.all([
      ctx.runQuery(internal.jobPreferences.getByWorkosUserIdInternal, { workosUserId: ctx.userId }),
      ctx.runQuery(internal.profiles.getByWorkosUserIdInternal, { workosUserId: ctx.userId }),
    ]);

    // Build Typesense filters from args + preferences
    const typesenseFilters: Record<string, unknown> = {};

    // Apply explicit filters from LLM
    if (args.filters) {
      if (args.filters.second_chance_only) {
        typesenseFilters.second_chance = true;
      }
      if (args.filters.city) {
        typesenseFilters.city = args.filters.city;
      }
      if (args.filters.state) {
        typesenseFilters.state = args.filters.state;
      }
      if (args.filters.bus_accessible) {
        typesenseFilters.bus_accessible = true;
      }
      if (args.filters.rail_accessible) {
        typesenseFilters.rail_accessible = true;
      }
      if (args.filters.urgent_only) {
        typesenseFilters.is_urgent = true;
      }
      if (args.filters.easy_apply_only) {
        typesenseFilters.is_easy_apply = true;
      }

      // Convert shift array to individual filters
      if (args.filters.shifts) {
        for (const shift of args.filters.shifts) {
          typesenseFilters[`shift_${shift}`] = true;
        }
      }
    }

    // Apply user preferences (if set) - these are implicit, not from LLM
    if (prefs?.requireSecondChance) {
      typesenseFilters.second_chance = true;
    }
    if (prefs?.requireBusAccessible) {
      typesenseFilters.bus_accessible = true;
    }
    if (prefs?.requireRailAccessible) {
      typesenseFilters.rail_accessible = true;
    }

    // Build shift preferences array for OR filtering
    // Note: Shift preferences use OR logic - show jobs that match ANY preferred shift
    const shiftPreferences: string[] = [];
    if (prefs?.shiftMorning) shiftPreferences.push("morning");
    if (prefs?.shiftAfternoon) shiftPreferences.push("afternoon");
    if (prefs?.shiftEvening) shiftPreferences.push("evening");
    if (prefs?.shiftOvernight) shiftPreferences.push("overnight");
    if (prefs?.shiftFlexible) shiftPreferences.push("flexible");

    // Build geo filter for Typesense pre-filtering (wide radius)
    let geoFilter: { lat: number; lng: number; radiusKm: number } | undefined;
    if (profile?.homeLat && profile?.homeLon) {
      // Pre-filter with wide radius - we'll do precise isochrone filtering after
      geoFilter = {
        lat: profile.homeLat,
        lng: profile.homeLon,
        radiusKm: 80, // ~50 miles - catches anything potentially reachable
      };
    }

    // Execute Typesense search
    const searchResults = await ctx.runAction(internal.scrapedJobsSearch.searchWithGeo, {
      query: args.query,
      filters: typesenseFilters,
      shiftPreferences: shiftPreferences.length > 0 ? shiftPreferences : undefined,
      geoFilter,
      limit: args.limit * 3, // Fetch extra since we'll filter some out
    });

    // Extract hits from Typesense response
    let jobs: Array<{
      document: {
        id: string;
        title: string;
        company: string;
        description?: string;
        location?: [number, number];
        city?: string;
        state?: string;
        salary_min?: number;
        salary_max?: number;
        salary_type?: string;
        second_chance?: boolean;
        second_chance_tier?: string;
        shift_morning?: boolean;
        shift_afternoon?: boolean;
        shift_evening?: boolean;
        shift_overnight?: boolean;
        shift_flexible?: boolean;
        bus_accessible?: boolean;
        rail_accessible?: boolean;
        is_urgent?: boolean;
        is_easy_apply?: boolean;
        url: string;
      };
    }> = searchResults?.hits ?? [];

    // Apply isochrone filtering if user has transit zones and requires transit
    if (
      profile?.isochrones &&
      prefs?.requirePublicTransit &&
      profile.homeLat &&
      profile.homeLon
    ) {
      const maxMinutes = (prefs.maxCommuteMinutes ?? 30) as 10 | 30 | 60;

      // Filter by actual isochrone polygon
      const jobsWithLocation = jobs.map((hit) => ({
        ...hit,
        id: hit.document.id,
        location: hit.document.location,
      }));

      const filteredJobs = filterByIsochrone(
        jobsWithLocation,
        profile.isochrones as IsochroneData,
        maxMinutes
      );

      jobs = filteredJobs;
    }

    // Limit results
    jobs = jobs.slice(0, args.limit);

    // Format salary string
    const formatSalary = (doc: {
      salary_min?: number;
      salary_max?: number;
      salary_type?: string;
    }): string | null => {
      if (!doc.salary_min && !doc.salary_max) return null;

      const type = doc.salary_type ?? "hourly";
      const min = doc.salary_min ? `$${doc.salary_min.toLocaleString()}` : "";
      const max = doc.salary_max ? `$${doc.salary_max.toLocaleString()}` : "";

      if (min && max && min !== max) {
        return `${min} - ${max}/${type}`;
      }
      return `${min || max}/${type}`;
    };

    // Extract shift types
    const extractShifts = (doc: {
      shift_morning?: boolean;
      shift_afternoon?: boolean;
      shift_evening?: boolean;
      shift_overnight?: boolean;
      shift_flexible?: boolean;
    }): string[] => {
      const shifts: string[] = [];
      if (doc.shift_morning) shifts.push("morning");
      if (doc.shift_afternoon) shifts.push("afternoon");
      if (doc.shift_evening) shifts.push("evening");
      if (doc.shift_overnight) shifts.push("overnight");
      if (doc.shift_flexible) shifts.push("flexible");
      return shifts;
    };

    // Return sanitized results
    return jobs.map((hit) => {
      const doc = hit.document;
      return {
        id: doc.id,
        title: doc.title,
        company: doc.company,
        location: doc.city && doc.state ? `${doc.city}, ${doc.state}` : null,
        description: doc.description
          ? doc.description.substring(0, 500) + (doc.description.length > 500 ? "..." : "")
          : null,
        salary: formatSalary(doc),
        isSecondChance: doc.second_chance ?? false,
        secondChanceTier: doc.second_chance_tier ?? null,
        shifts: extractShifts(doc),
        transitAccessible: (doc.bus_accessible || doc.rail_accessible) ?? false,
        busAccessible: doc.bus_accessible ?? false,
        railAccessible: doc.rail_accessible ?? false,
        isUrgent: doc.is_urgent ?? false,
        isEasyApply: doc.is_easy_apply ?? false,
        url: doc.url,
      };
    });
  },
});

export const tools = {
  getMyResume,
  getMyJobPreferences,
  searchJobs,
};
```

---

## Phase 7: Agent Definition

**File: `convex/jobMatcher/agent.ts`**

```typescript
import { Agent } from "@convex-dev/agent";
import { components } from "../_generated/api";
import { tools } from "./tools";

// Use Groq for high-quality, fast inference
// Note: Requires @ai-sdk/groq package and GROQ_API_KEY env var set in Convex dashboard
import { createGroq } from "@ai-sdk/groq";

// Groq SDK will automatically use GROQ_API_KEY from environment
const groq = createGroq();

export const jobMatcherAgent = new Agent(components.agent, {
  name: "Job Matcher",
  languageModel: groq("llama-3.3-70b-versatile"),
  
  instructions: `You are a job matching assistant for Recovery Jobs, a platform helping people find employment. Many users benefit from second-chance/fair-chance employers who are open to hiring people with criminal backgrounds.

## Your Role

Help users find jobs that match their skills, experience, and preferences. You have access to:
1. The user's resume (skills, work history, education)
2. Their job search preferences (commute limits, shift preferences, second-chance employer preference)
3. A job search tool that automatically filters by their location/commute constraints

## Process

1. **First**, call getMyResume to understand the user's background
2. **Then**, call getMyJobPreferences to understand their constraints and preferences
3. **Search strategically**:
   - Extract key skills and job titles from their resume
   - Run 2-3 searches with different relevant keywords
   - If they prefer second-chance employers, prioritize those in your filters
4. **Return results** as a structured list with match explanations

## Important Guidelines

- The searchJobs tool AUTOMATICALLY handles location/commute filtering based on the user's settings. You don't need to worry about geography.
- Be specific about WHY each job matches. Reference actual skills, experience, or stated preferences.
- If the user has no resume, acknowledge this and suggest they create one first.
- If searching returns few results, try broader search terms or suggest the user adjust their preferences.
- Prioritize quality over quantity - it's better to return 5 great matches than 15 mediocre ones.

## Response Format

Always return your final response as a JSON object with this structure:
{
  "summary": "Brief overview of what you found and search strategy",
  "jobs": [
    {
      "id": "job-id",
      "title": "Job Title",
      "company": "Company Name",
      "location": "City, State",
      "matchReason": "Why this job matches the user's background",
      "highlights": ["Key point 1", "Key point 2"],
      "salary": "$X/hour" or null,
      "isSecondChance": true/false,
      "shifts": ["morning", "flexible"],
      "url": "https://..."
    }
  ],
  "suggestions": ["Optional suggestions for better results"]
}`,

  tools,
});
```

---

## Phase 8: Agent Actions

We split this into two files because agent actions require Node.js runtime but queries/mutations don't.

**File: `convex/jobMatcher/queries.ts`** (queries and mutations - no Node.js required)

```typescript
import { v } from "convex/values";
import { internalMutation, query } from "../_generated/server";

/**
 * Get the user's active job search (if any)
 */
export const getActiveSearch = query({
  args: {},
  returns: v.union(
    v.object({
      _id: v.id("jobSearches"),
      threadId: v.string(),
      status: v.string(),
      initialPrompt: v.string(),
      startedAt: v.number(),
    }),
    v.null()
  ),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    return await ctx.db
      .query("jobSearches")
      .withIndex("by_workos_user_id_status", (q) =>
        q.eq("workosUserId", identity.subject).eq("status", "active")
      )
      .first();
  },
});

/**
 * Get all job searches for the current user (for history)
 */
export const listSearches = query({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("jobSearches"),
      threadId: v.string(),
      status: v.string(),
      initialPrompt: v.string(),
      startedAt: v.number(),
      completedAt: v.optional(v.number()),
    })
  ),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    return await ctx.db
      .query("jobSearches")
      .withIndex("by_workos_user_id", (q) => q.eq("workosUserId", identity.subject))
      .order("desc")
      .collect();
  },
});

/**
 * Internal mutation to create a job search record
 */
export const createSearchRecord = internalMutation({
  args: {
    workosUserId: v.string(),
    threadId: v.string(),
    initialPrompt: v.string(),
  },
  returns: v.id("jobSearches"),
  handler: async (ctx, args) => {
    // Mark any existing active searches as completed
    const existing = await ctx.db
      .query("jobSearches")
      .withIndex("by_workos_user_id_status", (q) =>
        q.eq("workosUserId", args.workosUserId).eq("status", "active")
      )
      .collect();

    for (const search of existing) {
      await ctx.db.patch(search._id, {
        status: "completed",
        completedAt: Date.now(),
      });
    }

    // Create new search record
    return await ctx.db.insert("jobSearches", {
      workosUserId: args.workosUserId,
      threadId: args.threadId,
      status: "active",
      initialPrompt: args.initialPrompt,
      startedAt: Date.now(),
    });
  },
});

export const markSearchCancelled = internalMutation({
  args: {
    searchId: v.id("jobSearches"),
    workosUserId: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const search = await ctx.db.get(args.searchId);
    if (!search || search.workosUserId !== args.workosUserId) {
      throw new Error("Search not found or not authorized");
    }

    await ctx.db.patch(args.searchId, {
      status: "cancelled",
      completedAt: Date.now(),
    });

    return null;
  },
});
```

**File: `convex/jobMatcher/actions.ts`** (Node.js actions for AI)

```typescript
"use node";

import { v } from "convex/values";
import { action } from "../_generated/server";
import { internal } from "../_generated/api";
import { jobMatcherAgent } from "./agent";

/**
 * Start a new job search or continue an existing one
 */
export const startSearch = action({
  args: {
    prompt: v.string(),
    threadId: v.optional(v.string()),
  },
  returns: v.object({
    threadId: v.string(),
    isNew: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const userId = identity.subject;

    // If continuing existing thread
    if (args.threadId) {
      const { thread } = await jobMatcherAgent.continueThread(ctx, {
        threadId: args.threadId,
        userId,
      });

      // Stream response with deltas saved to DB for real-time updates
      await thread.streamText(
        { prompt: args.prompt },
        { saveStreamDeltas: true }
      );

      return { threadId: args.threadId, isNew: false };
    }

    // Create new thread
    const { threadId, thread } = await jobMatcherAgent.createThread(ctx, {
      userId,
    });

    // Record the search
    await ctx.runMutation(internal.jobMatcher.queries.createSearchRecord, {
      workosUserId: userId,
      threadId,
      initialPrompt: args.prompt,
    });

    // Stream response with deltas saved to DB for real-time updates
    await thread.streamText(
      { prompt: args.prompt },
      { saveStreamDeltas: true }
    );

    return { threadId, isNew: true };
  },
});

/**
 * Send a follow-up message to an existing search
 */
export const sendMessage = action({
  args: {
    threadId: v.string(),
    message: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const { thread } = await jobMatcherAgent.continueThread(ctx, {
      threadId: args.threadId,
      userId: identity.subject,
    });

    // Stream response with deltas saved to DB for real-time updates
    await thread.streamText(
      { prompt: args.message },
      { saveStreamDeltas: true }
    );

    return null;
  },
});

/**
 * Cancel an active search
 */
export const cancelSearch = action({
  args: {
    searchId: v.id("jobSearches"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    await ctx.runMutation(internal.jobMatcher.queries.markSearchCancelled, {
      searchId: args.searchId,
      workosUserId: identity.subject,
    });

    return null;
  },
});
```

---

## Phase 9: Message Listing Query

**File: `convex/jobMatcher/messages.ts`**

```typescript
import { v } from "convex/values";
import { query } from "../_generated/server";
import { vStreamArgs, listUIMessages, syncStreams } from "@convex-dev/agent";
import { paginationOptsValidator } from "convex/server";
import { components } from "../_generated/api";

/**
 * List messages from a job search thread with streaming support
 */
export const listThreadMessages = query({
  args: {
    threadId: v.string(),
    paginationOpts: paginationOptsValidator,
    streamArgs: vStreamArgs,
  },
  returns: v.any(), // Complex paginated response with streams
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    // Verify user owns this thread by checking jobSearches
    const search = await ctx.db
      .query("jobSearches")
      .withIndex("by_thread_id", (q) => q.eq("threadId", args.threadId))
      .unique();

    if (!search || search.workosUserId !== identity.subject) {
      throw new Error("Thread not found or not authorized");
    }

    // Fetch messages with pagination
    const paginated = await listUIMessages(ctx, components.agent, {
      threadId: args.threadId,
      paginationOpts: args.paginationOpts,
    });

    // Sync streaming deltas
    const streams = await syncStreams(ctx, components.agent, {
      threadId: args.threadId,
      streamArgs: args.streamArgs,
    });

    return { ...paginated, streams };
  },
});
```

---

## Phase 10: Module Exports

**File: `convex/jobMatcher/index.ts`**

```typescript
// Re-export all job matcher functionality
export { jobMatcherAgent } from "./agent";
export { tools } from "./tools";
export * from "./queries";   // queries and mutations (non-Node)
export * from "./actions";   // Node.js actions for AI
export * from "./messages";
```

---

## Phase 11: Internal Query Exports

We need to expose internal queries for the tools to use. Add these to the existing files:

**File: `convex/resumes.ts`** (add this export)

```typescript
// Add this internal query for agent tools - note: the public getByWorkosUserId already exists,
// we add an internal version for use by internal actions/tools
export const getByWorkosUserIdInternal = internalQuery({
  args: { workosUserId: v.string() },
  returns: v.any(),
  handler: async (ctx, args) => {
    return await ctx.db
      .query("resumes")
      .withIndex("by_workos_user_id", (q) => q.eq("workosUserId", args.workosUserId))
      .first();
  },
});
```

**File: `convex/profiles.ts`** (add this export)

```typescript
// Add this internal query for agent tools - note: the public getByWorkosUserId already exists,
// we add an internal version for use by internal actions/tools
export const getByWorkosUserIdInternal = internalQuery({
  args: { workosUserId: v.string() },
  returns: v.any(),
  handler: async (ctx, args) => {
    return await ctx.db
      .query("profiles")
      .withIndex("by_workos_user_id", (q) => q.eq("workosUserId", args.workosUserId))
      .unique();
  },
});
```

**File: `convex/jobPreferences.ts`** (the internal query is already defined in Phase 3, but ensure it's named correctly)

Note: The `getByWorkosUserIdInternal` internal query for jobPreferences should be added alongside the public `get` query in Phase 3. Update that section to include:

---

## Phase 12: Frontend Components

### 12.1 Job Matcher Page

**File: `src/routes/_authenticated/jobs.tsx`**

```typescript
import { createFileRoute } from "@tanstack/react-router";
import { JobMatcher } from "~/components/JobMatcher";
import { JobPreferencesForm } from "~/components/JobPreferencesForm";
import { useAuth } from "@workos/authkit-tanstack-react-start";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";

export const Route = createFileRoute("/_authenticated/jobs")({
  component: JobsPage,
});

function JobsPage() {
  const { user } = useAuth();

  if (!user) {
    return <div>Loading...</div>;
  }

  return (
    <div className="container mx-auto max-w-4xl py-8 px-4">
      <h1 className="text-3xl font-bold mb-6">Find Jobs</h1>

      <Tabs defaultValue="search" className="w-full">
        <TabsList className="mb-6">
          <TabsTrigger value="search">Job Search</TabsTrigger>
          <TabsTrigger value="preferences">Preferences</TabsTrigger>
        </TabsList>

        <TabsContent value="search">
          <JobMatcher workosUserId={user.id} />
        </TabsContent>

        <TabsContent value="preferences">
          <JobPreferencesForm />
        </TabsContent>
      </Tabs>
    </div>
  );
}
```

### 12.2 Job Matcher Component

**File: `src/components/JobMatcher.tsx`**

```typescript
import { useState, FormEvent } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useConvexMutation, convexQuery } from "@convex-dev/react-query";
import { useUIMessages } from "@convex-dev/agent/react";
import { api } from "../../convex/_generated/api";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Loader2, Search, MessageSquare, ExternalLink } from "lucide-react";
import { JobMatchResults } from "./JobMatchResults";

interface JobMatcherProps {
  workosUserId: string;
}

export function JobMatcher({ workosUserId }: JobMatcherProps) {
  const [prompt, setPrompt] = useState("Find jobs matching my resume and preferences");
  const [followUpInput, setFollowUpInput] = useState("");
  const [showChat, setShowChat] = useState(false);

  // Check for active search (query is in queries.ts)
  const { data: activeSearch, isLoading: searchLoading } = useQuery(
    convexQuery(api.jobMatcher.queries.getActiveSearch, {})
  );

  // Start search action (action is in actions.ts)
  const { mutate: startSearch, isPending: isStarting } = useMutation({
    mutationFn: useConvexMutation(api.jobMatcher.actions.startSearch),
  });

  // Send follow-up action (action is in actions.ts)
  const { mutate: sendMessage, isPending: isSending } = useMutation({
    mutationFn: useConvexMutation(api.jobMatcher.actions.sendMessage),
  });

  // Subscribe to thread messages (survives page refresh!)
  const { results: messages, status: streamStatus } = useUIMessages(
    api.jobMatcher.messages.listThreadMessages,
    activeSearch ? { threadId: activeSearch.threadId } : "skip",
    { initialNumItems: 50, stream: true }
  );

  const isProcessing = isStarting || isSending || streamStatus === "streaming";

  const handleStartSearch = (e: FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() || isProcessing) return;

    startSearch({
      prompt: prompt.trim(),
      threadId: activeSearch?.threadId,
    });
  };

  const handleFollowUp = (e: FormEvent) => {
    e.preventDefault();
    if (!followUpInput.trim() || !activeSearch || isProcessing) return;

    sendMessage({
      threadId: activeSearch.threadId,
      message: followUpInput.trim(),
    });
    setFollowUpInput("");
  };

  const handleNewSearch = () => {
    setPrompt("Find jobs matching my resume and preferences");
    setShowChat(false);
    startSearch({
      prompt: "Find jobs matching my resume and preferences",
    });
  };

  if (searchLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // No active search - show search form
  if (!activeSearch) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            AI-Powered Job Search
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground mb-4">
            Our AI will analyze your resume and preferences to find the best job matches for you.
          </p>

          <form onSubmit={handleStartSearch} className="space-y-4">
            <div>
              <label htmlFor="prompt" className="text-sm font-medium mb-2 block">
                What are you looking for?
              </label>
              <Input
                id="prompt"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Find jobs matching my resume and preferences"
                disabled={isStarting}
              />
              <p className="text-xs text-muted-foreground mt-1">
                You can customize this or use the default prompt
              </p>
            </div>

            <Button type="submit" disabled={isStarting || !prompt.trim()} className="w-full">
              {isStarting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Starting search...
                </>
              ) : (
                <>
                  <Search className="mr-2 h-4 w-4" />
                  Find Jobs For Me
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    );
  }

  // Active search - show results and chat
  return (
    <div className="space-y-6">
      {/* Results */}
      <JobMatchResults messages={messages} isStreaming={streamStatus === "streaming"} />

      {/* Follow-up section */}
      <Card>
        <CardContent className="pt-6">
          {!showChat ? (
            <div className="flex flex-col sm:flex-row gap-3">
              <Button variant="outline" onClick={() => setShowChat(true)} className="flex-1">
                <MessageSquare className="mr-2 h-4 w-4" />
                Ask a follow-up question
              </Button>
              <Button variant="secondary" onClick={handleNewSearch} className="flex-1">
                <Search className="mr-2 h-4 w-4" />
                Start new search
              </Button>
            </div>
          ) : (
            <form onSubmit={handleFollowUp} className="space-y-3">
              <Input
                value={followUpInput}
                onChange={(e) => setFollowUpInput(e.target.value)}
                placeholder="Ask about jobs, refine your search..."
                disabled={isSending}
              />
              <div className="flex gap-2">
                <Button type="submit" disabled={isSending || !followUpInput.trim()}>
                  {isSending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <MessageSquare className="mr-2 h-4 w-4" />
                  )}
                  Send
                </Button>
                <Button type="button" variant="ghost" onClick={() => setShowChat(false)}>
                  Cancel
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
```

### 12.3 Job Match Results Component

**File: `src/components/JobMatchResults.tsx`**

```typescript
import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "./ui/card";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Loader2, ExternalLink, Clock, MapPin, DollarSign, Bus, Train, Star } from "lucide-react";
import { SmoothText } from "@convex-dev/agent/react";
import type { UIMessage } from "@convex-dev/agent/react";

interface JobMatch {
  id: string;
  title: string;
  company: string;
  location: string | null;
  matchReason: string;
  highlights: string[];
  salary: string | null;
  isSecondChance: boolean;
  shifts: string[];
  url: string;
}

interface ParsedResponse {
  summary: string;
  jobs: JobMatch[];
  suggestions?: string[];
}

interface JobMatchResultsProps {
  messages: UIMessage[];
  isStreaming: boolean;
}

export function JobMatchResults({ messages, isStreaming }: JobMatchResultsProps) {
  // Find the latest assistant message with job results
  const latestResult = useMemo(() => {
    // Look for assistant messages in reverse order
    for (let i = messages.length - 1; i >= 0; i--) {
      const msg = messages[i];
      if (msg.role === "assistant" && msg.text) {
        try {
          // Try to parse as JSON
          const parsed = JSON.parse(msg.text) as ParsedResponse;
          if (parsed.jobs && Array.isArray(parsed.jobs)) {
            return parsed;
          }
        } catch {
          // Not JSON or invalid format - might be streaming
        }
      }
    }
    return null;
  }, [messages]);

  // Get the latest streaming text if still streaming
  const streamingText = useMemo(() => {
    if (!isStreaming) return null;
    const lastMsg = messages[messages.length - 1];
    if (lastMsg?.role === "assistant" && lastMsg.status === "streaming") {
      return lastMsg.text;
    }
    return null;
  }, [messages, isStreaming]);

  if (messages.length === 0) {
    return null;
  }

  // Still streaming - show progress
  if (isStreaming && !latestResult) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-muted-foreground text-center">
              Analyzing your resume and searching for matches...
            </p>
            {streamingText && (
              <div className="text-sm text-muted-foreground max-w-md text-center">
                <SmoothText text={streamingText} />
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!latestResult) {
    return (
      <Card>
        <CardContent className="py-8">
          <p className="text-muted-foreground text-center">
            No job matches found yet. Try adjusting your search.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Search Results</CardTitle>
          <CardDescription>{latestResult.summary}</CardDescription>
        </CardHeader>
      </Card>

      {/* Job Cards */}
      <div className="grid gap-4">
        {latestResult.jobs.map((job) => (
          <JobCard key={job.id} job={job} />
        ))}
      </div>

      {/* Suggestions */}
      {latestResult.suggestions && latestResult.suggestions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Suggestions</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
              {latestResult.suggestions.map((suggestion, i) => (
                <li key={i}>{suggestion}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function JobCard({ job }: { job: JobMatch }) {
  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle className="text-lg">{job.title}</CardTitle>
            <CardDescription className="text-base font-medium">{job.company}</CardDescription>
          </div>
          <div className="flex flex-wrap gap-1">
            {job.isSecondChance && (
              <Badge variant="secondary" className="bg-green-100 text-green-800">
                <Star className="h-3 w-3 mr-1" />
                Second Chance
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Location & Salary */}
        <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
          {job.location && (
            <span className="flex items-center gap-1">
              <MapPin className="h-4 w-4" />
              {job.location}
            </span>
          )}
          {job.salary && (
            <span className="flex items-center gap-1">
              <DollarSign className="h-4 w-4" />
              {job.salary}
            </span>
          )}
        </div>

        {/* Shifts */}
        {job.shifts.length > 0 && (
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <div className="flex flex-wrap gap-1">
              {job.shifts.map((shift) => (
                <Badge key={shift} variant="outline" className="text-xs capitalize">
                  {shift}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Match Reason */}
        <div className="bg-muted/50 rounded-md p-3">
          <p className="text-sm font-medium mb-1">Why this matches:</p>
          <p className="text-sm text-muted-foreground">{job.matchReason}</p>
        </div>

        {/* Highlights */}
        {job.highlights.length > 0 && (
          <ul className="text-sm space-y-1">
            {job.highlights.map((highlight, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="text-primary">•</span>
                {highlight}
              </li>
            ))}
          </ul>
        )}

        {/* Apply Button */}
        <Button asChild className="w-full mt-2">
          <a href={job.url} target="_blank" rel="noopener noreferrer">
            Apply Now
            <ExternalLink className="ml-2 h-4 w-4" />
          </a>
        </Button>
      </CardContent>
    </Card>
  );
}
```

### 12.4 Job Preferences Form

**File: `src/components/JobPreferencesForm.tsx`**

```typescript
import { useForm } from "@tanstack/react-form";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useConvexMutation, convexQuery } from "@convex-dev/react-query";
import { api } from "../../convex/_generated/api";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "./ui/card";
import { Checkbox } from "./ui/checkbox";
import { Label } from "./ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Loader2, Save } from "lucide-react";
import { useToast } from "~/hooks/use-toast";

export function JobPreferencesForm() {
  const { toast } = useToast();

  const { data: preferences, isLoading } = useQuery(
    convexQuery(api.jobPreferences.get, {})
  );

  const { mutate: upsert, isPending } = useMutation({
    mutationFn: useConvexMutation(api.jobPreferences.upsert),
    onSuccess: () => {
      toast({
        title: "Preferences saved",
        description: "Your job search preferences have been updated.",
      });
    },
  });

  const form = useForm({
    defaultValues: {
      maxCommuteMinutes: preferences?.maxCommuteMinutes ?? undefined,
      requirePublicTransit: preferences?.requirePublicTransit ?? false,
      preferSecondChance: preferences?.preferSecondChance ?? false,
      requireSecondChance: preferences?.requireSecondChance ?? false,
      shiftMorning: preferences?.shiftMorning ?? false,
      shiftAfternoon: preferences?.shiftAfternoon ?? false,
      shiftEvening: preferences?.shiftEvening ?? false,
      shiftOvernight: preferences?.shiftOvernight ?? false,
      shiftFlexible: preferences?.shiftFlexible ?? false,
      requireBusAccessible: preferences?.requireBusAccessible ?? false,
      requireRailAccessible: preferences?.requireRailAccessible ?? false,
      preferUrgent: preferences?.preferUrgent ?? false,
      preferEasyApply: preferences?.preferEasyApply ?? false,
    },
    onSubmit: async ({ value }) => {
      // Only include values that are set (not false for booleans, not undefined for others)
      const data: Record<string, unknown> = {};

      if (value.maxCommuteMinutes) data.maxCommuteMinutes = value.maxCommuteMinutes;
      if (value.requirePublicTransit) data.requirePublicTransit = true;
      if (value.preferSecondChance) data.preferSecondChance = true;
      if (value.requireSecondChance) data.requireSecondChance = true;
      if (value.shiftMorning) data.shiftMorning = true;
      if (value.shiftAfternoon) data.shiftAfternoon = true;
      if (value.shiftEvening) data.shiftEvening = true;
      if (value.shiftOvernight) data.shiftOvernight = true;
      if (value.shiftFlexible) data.shiftFlexible = true;
      if (value.requireBusAccessible) data.requireBusAccessible = true;
      if (value.requireRailAccessible) data.requireRailAccessible = true;
      if (value.preferUrgent) data.preferUrgent = true;
      if (value.preferEasyApply) data.preferEasyApply = true;

      upsert(data);
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        form.handleSubmit();
      }}
    >
      <div className="space-y-6">
        {/* Commute Preferences */}
        <Card>
          <CardHeader>
            <CardTitle>Commute</CardTitle>
            <CardDescription>
              Set your maximum commute time and transit preferences. Make sure to set your home
              location on your profile first!
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <form.Field name="maxCommuteMinutes">
              {(field) => (
                <div className="space-y-2">
                  <Label>Maximum commute time</Label>
                  <Select
                    value={field.state.value?.toString() ?? ""}
                    onValueChange={(v) => field.handleChange(v ? (parseInt(v) as 10 | 30 | 60) : undefined)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="No limit" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">No limit</SelectItem>
                      <SelectItem value="10">10 minutes</SelectItem>
                      <SelectItem value="30">30 minutes</SelectItem>
                      <SelectItem value="60">60 minutes</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </form.Field>

            <form.Field name="requirePublicTransit">
              {(field) => (
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="requirePublicTransit"
                    checked={field.state.value}
                    onCheckedChange={(checked) => field.handleChange(!!checked)}
                  />
                  <Label htmlFor="requirePublicTransit">
                    Only show jobs reachable by public transit
                  </Label>
                </div>
              )}
            </form.Field>

            <div className="flex gap-4">
              <form.Field name="requireBusAccessible">
                {(field) => (
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="requireBusAccessible"
                      checked={field.state.value}
                      onCheckedChange={(checked) => field.handleChange(!!checked)}
                    />
                    <Label htmlFor="requireBusAccessible">Require bus access</Label>
                  </div>
                )}
              </form.Field>

              <form.Field name="requireRailAccessible">
                {(field) => (
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="requireRailAccessible"
                      checked={field.state.value}
                      onCheckedChange={(checked) => field.handleChange(!!checked)}
                    />
                    <Label htmlFor="requireRailAccessible">Require rail access</Label>
                  </div>
                )}
              </form.Field>
            </div>
          </CardContent>
        </Card>

        {/* Second Chance Preferences */}
        <Card>
          <CardHeader>
            <CardTitle>Second Chance Employers</CardTitle>
            <CardDescription>
              Second-chance employers are open to hiring people with criminal backgrounds.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <form.Field name="preferSecondChance">
              {(field) => (
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="preferSecondChance"
                    checked={field.state.value}
                    onCheckedChange={(checked) => field.handleChange(!!checked)}
                  />
                  <Label htmlFor="preferSecondChance">
                    Prioritize second-chance employers in results
                  </Label>
                </div>
              )}
            </form.Field>

            <form.Field name="requireSecondChance">
              {(field) => (
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="requireSecondChance"
                    checked={field.state.value}
                    onCheckedChange={(checked) => field.handleChange(!!checked)}
                  />
                  <Label htmlFor="requireSecondChance">
                    Only show second-chance employers
                  </Label>
                </div>
              )}
            </form.Field>
          </CardContent>
        </Card>

        {/* Shift Preferences */}
        <Card>
          <CardHeader>
            <CardTitle>Shift Availability</CardTitle>
            <CardDescription>
              Select the shifts you're available to work. Leave all unchecked for no preference.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <form.Field name="shiftMorning">
                {(field) => (
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="shiftMorning"
                      checked={field.state.value}
                      onCheckedChange={(checked) => field.handleChange(!!checked)}
                    />
                    <Label htmlFor="shiftMorning">Morning</Label>
                  </div>
                )}
              </form.Field>

              <form.Field name="shiftAfternoon">
                {(field) => (
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="shiftAfternoon"
                      checked={field.state.value}
                      onCheckedChange={(checked) => field.handleChange(!!checked)}
                    />
                    <Label htmlFor="shiftAfternoon">Afternoon</Label>
                  </div>
                )}
              </form.Field>

              <form.Field name="shiftEvening">
                {(field) => (
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="shiftEvening"
                      checked={field.state.value}
                      onCheckedChange={(checked) => field.handleChange(!!checked)}
                    />
                    <Label htmlFor="shiftEvening">Evening</Label>
                  </div>
                )}
              </form.Field>

              <form.Field name="shiftOvernight">
                {(field) => (
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="shiftOvernight"
                      checked={field.state.value}
                      onCheckedChange={(checked) => field.handleChange(!!checked)}
                    />
                    <Label htmlFor="shiftOvernight">Overnight</Label>
                  </div>
                )}
              </form.Field>

              <form.Field name="shiftFlexible">
                {(field) => (
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="shiftFlexible"
                      checked={field.state.value}
                      onCheckedChange={(checked) => field.handleChange(!!checked)}
                    />
                    <Label htmlFor="shiftFlexible">Flexible</Label>
                  </div>
                )}
              </form.Field>
            </div>
          </CardContent>
        </Card>

        {/* Other Preferences */}
        <Card>
          <CardHeader>
            <CardTitle>Other Preferences</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <form.Field name="preferUrgent">
              {(field) => (
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="preferUrgent"
                    checked={field.state.value}
                    onCheckedChange={(checked) => field.handleChange(!!checked)}
                  />
                  <Label htmlFor="preferUrgent">Prioritize urgent hiring</Label>
                </div>
              )}
            </form.Field>

            <form.Field name="preferEasyApply">
              {(field) => (
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="preferEasyApply"
                    checked={field.state.value}
                      onCheckedChange={(checked) => field.handleChange(!!checked)}
                  />
                  <Label htmlFor="preferEasyApply">Prioritize easy apply jobs</Label>
                </div>
              )}
            </form.Field>
          </CardContent>
        </Card>

        {/* Submit */}
        <Button type="submit" disabled={isPending} className="w-full">
          {isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="mr-2 h-4 w-4" />
              Save Preferences
            </>
          )}
        </Button>
      </div>
    </form>
  );
}
```

---

## Phase 13: Environment Variables

Add to Convex environment (via dashboard or CLI):

```bash
# Required for agent
GROQ_API_KEY=gsk_...

# Already required for Typesense
TYPESENSE_URL=https://...
TYPESENSE_API_KEY=...
```

---

## File Summary

| File | Action | Description |
|------|--------|-------------|
| `package.json` | Modify | Add `@convex-dev/agent`, `@ai-sdk/groq`, `@turf/*` |
| `convex/convex.config.ts` | **Create** | Register agent component |
| `convex/schema.ts` | Modify | Add `jobPreferences`, `jobSearches` tables |
| `convex/jobPreferences.ts` | **Create** | CRUD for job preferences |
| `convex/lib/geoFilter.ts` | **Create** | Turf.js isochrone filtering |
| `convex/scrapedJobsSearch.ts` | Modify | Add `searchWithGeo` internal action with OR shift logic |
| `convex/jobMatcher/tools.ts` | **Create** | Secure, context-aware tools |
| `convex/jobMatcher/agent.ts` | **Create** | Agent definition with Groq |
| `convex/jobMatcher/queries.ts` | **Create** | Queries and mutations (non-Node) |
| `convex/jobMatcher/actions.ts` | **Create** | Node.js actions for AI (startSearch, sendMessage) |
| `convex/jobMatcher/messages.ts` | **Create** | listThreadMessages query |
| `convex/jobMatcher/index.ts` | **Create** | Module exports |
| `convex/resumes.ts` | Modify | Add `getByWorkosUserIdInternal` query |
| `convex/profiles.ts` | Modify | Add `getByWorkosUserIdInternal` query |
| `src/routes/_authenticated/jobs.tsx` | **Create** | Jobs page route |
| `src/components/JobMatcher.tsx` | **Create** | Main job matcher UI |
| `src/components/JobMatchResults.tsx` | **Create** | Results display with cards |
| `src/components/JobPreferencesForm.tsx` | **Create** | Preferences form |

---

## Future Enhancements

### Chat Evolution Path

The current architecture supports seamless evolution to a full chat interface:

1. **Stage 1 (MVP)**: Button + editable prompt → structured results
2. **Stage 2**: Add follow-up questions in same thread
3. **Stage 3**: Full chat UI with message history
4. **Stage 4**: Save/bookmark jobs (add `savedJobs` table + tool)
5. **Stage 5**: Job alerts (scheduled searches)

### Additional Tools to Consider

```typescript
// Save a job for later
const saveJob = createTool({
  description: "Save a job to the user's bookmarks for later review",
  args: z.object({
    jobId: z.string(),
    notes: z.string().optional(),
  }),
  handler: async (ctx, args) => { /* ... */ },
});

// Get saved jobs
const getMySavedJobs = createTool({
  description: "Get the user's saved/bookmarked jobs",
  args: z.object({}),
  handler: async (ctx) => { /* ... */ },
});

// Get job details
const getJobDetails = createTool({
  description: "Get full details about a specific job",
  args: z.object({ jobId: z.string() }),
  handler: async (ctx, args) => { /* ... */ },
});
```

### Workflow Integration

For more complex multi-step processes, integrate with Convex Workflow component:

```typescript
const jobMatchWorkflow = workflow.define({
  args: { userId: v.string(), prompt: v.string() },
  handler: async (step, args) => {
    // Step 1: Create thread
    const { threadId } = await step.runMutation(internal.jobMatcher.createThread, args);
    
    // Step 2: Generate matches (with retries)
    await step.runAction(
      internal.jobMatcher.generateMatches,
      { threadId, prompt: args.prompt },
      { retry: true }
    );
    
    // Step 3: Send notification
    await step.runAction(internal.notifications.sendJobMatchEmail, { userId: args.userId });
  },
});
```
