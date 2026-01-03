# TypeScript Type Duplication Audit Report

## Executive Summary

The codebase has **significant type duplication** across several domains:
1. **Job types** - 6+ separate definitions of "job" shapes across scraper, matcher, search, and UI layers
2. **JobPreferences** - Same shape defined 3x (Convex schema, Convex validators, frontend interface)
3. **JobMatch** - Duplicate interface in two frontend components
4. **TypesenseJobDocument** - Defined twice in separate files
5. **Extensive use of `as` assertions** - 168+ occurrences, many indicating type system workarounds
6. **Use of `any`** - Primarily in generated files, but also in pipeline code

---

## Finding 1: Duplicate `JobMatch` Interface

### Files:
- **`src/components/chat/results/JobResultCard.tsx:21-32`**
- **`src/components/JobMatchResults.tsx:20-31`**

### Problem:
Both files define nearly identical `JobMatch` interfaces independently:

```typescript
// JobResultCard.tsx
export interface JobMatch {
  id: string
  title: string
  company: string
  location: string | null
  matchReason?: string        // ← optional here
  highlights?: Array<string>  // ← optional here
  salary: string | null
  isSecondChance: boolean
  shifts: Array<string>
  url: string
}

// JobMatchResults.tsx  
interface JobMatch {
  id: string
  title: string
  company: string
  location: string | null
  matchReason: string         // ← required here!
  highlights: Array<string>   // ← required here!
  salary: string | null
  isSecondChance: boolean
  shifts: Array<string>
  url: string
}
```

### Why This Is a Problem:
- Field optionality differs (`matchReason`, `highlights`)
- Copy-paste error risk—changes to one won't update the other
- `convex/jobMatcher/schema.ts` already defines the authoritative `JobMatch` Zod schema

### Recommended Source of Truth:
**`convex/jobMatcher/schema.ts`** – This already exports `jobMatchSchema` and `JobMatch` type.

---

## Finding 2: Job Preferences Shape Duplication (3x)

### Files:
- **`convex/schema.ts:67-93`** – Convex table definition
- **`convex/jobPreferences.ts:6-24`** – `jobPreferencesDocValidator` 
- **`src/components/jobs/FilterSummaryBanner.tsx:52-66`** – `JobPreferences` interface

### Problem:
The same 13 fields are defined three times:

| Field | schema.ts | jobPreferences.ts | FilterSummaryBanner.tsx |
|-------|-----------|-------------------|-------------------------|
| maxCommuteMinutes | ✓ | ✓ | ✓ |
| preferEasyApply | ✓ | ✓ | ✓ |
| preferSecondChance | ✓ | ✓ | ✓ |
| preferUrgent | ✓ | ✓ | ✓ |
| requireBusAccessible | ✓ | ✓ | ✓ |
| requirePublicTransit | ✓ | ✓ | ✓ |
| requireRailAccessible | ✓ | ✓ | ✓ |
| requireSecondChance | ✓ | ✓ | ✓ |
| shiftAfternoon | ✓ | ✓ | ✓ |
| shiftEvening | ✓ | ✓ | ✓ |
| shiftFlexible | ✓ | ✓ | ✓ |
| shiftMorning | ✓ | ✓ | ✓ |
| shiftOvernight | ✓ | ✓ | ✓ |

### Why This Is a Problem:
- Adding a new preference requires edits in 3 places
- Risk of type drift (different optionality, naming)

### Recommended Source of Truth:
Use **Convex's generated types** (`Doc<'jobPreferences'>`) in frontend, or create a shared Zod schema like profiles/resumes do.

---

## Finding 3: Job Entity Types Across Systems (6+ Definitions)

This is the most severe duplication:

### Files:
| File | Type Name | Purpose |
|------|-----------|---------|
| `scrape-pipeline/scrapers/snagajob.ts:14-57` | `SnagajobJob` | Scraper output |
| `scrape-pipeline/scrapers/craigslist.ts:32-72` | `CraigslistJob` | Scraper output |
| `scrape-pipeline/lib/typesense.ts:119-156` | `TypesenseJobDocument` | Search index doc |
| `convex/jobMatcher/tools.ts:338-361` | `TypesenseJobDocument` | **DUPLICATE!** |
| `convex/jobMatcher/tools.ts:52-68` | `SanitizedJob` | LLM-facing output |
| `convex/lib/jobSchema.ts:6-43` | `ParsedJobSchema` | Employer-submitted jobs |
| `convex/schema.ts:283-392` | `scrapedJobs` table | Database storage |

### Analysis:

**A. SnagajobJob vs CraigslistJob**
- Nearly identical shapes (both represent scraped jobs)
- ~80% field overlap: `id, title, company, pay, payMin, payMax, payType, city, state, latitude, longitude, description, descriptionText, isUrgent, isEasyApply, applyUrl, postedDate`
- Could share a common base type

**B. TypesenseJobDocument defined TWICE**
- `scrape-pipeline/lib/typesense.ts:125-156` (authoritative)
- `convex/jobMatcher/tools.ts:338-361` (inline duplicate!)

```typescript
// scrape-pipeline/lib/typesense.ts
export interface TypesenseJobDocument {
  id: string
  external_id: string
  source: string
  title: string
  // ... 24 more fields
}

// convex/jobMatcher/tools.ts (lines 338-361)
interface TypesenseJobDocument {
  id: string
  title: string
  company: string
  // ... same fields, different order
}
```

**C. Field Name Drift Between Layers**:
| Concept | Scraper | Typesense | Convex Table | UI |
|---------|---------|-----------|--------------|-----|
| Job ID | `id` | `id` | `_id` | `id` |
| Is fair-chance | `noBackgroundCheck` (deprecated) | `second_chance` | `secondChance` | `isSecondChance` |
| Urgently hiring | `isUrgent` | `is_urgent` | `isUrgent` | `isUrgent` |
| Pay rate type | `payType` | `salary_type` | `payType` | `salary` |

### Recommended Source of Truth:
Create a **canonical job schema** in `convex/lib/jobSchema.ts` or `src/lib/schemas/job.ts` that all systems derive from.

---

## Finding 4: Excessive Type Assertions (`as`)

Found **168+ type assertions** across the codebase. Most problematic:

### Category A: Convex ID Casting (Common Pattern)
```typescript
// convex/applications.ts:344, 364, 460, 476, 518, 534
const senderId = tokenData.senderId as Id<'senders'>;
const jobId = tokenData.submissionId as Id<'jobSubmissions'>;

// convex/inngest/processJob.ts:35
const submissionId = event.data.submissionId as Id<'jobSubmissions'>;

// convex/inngest/processApplication.ts:63, 77, 82
id: jobSubmissionId as Id<'jobSubmissions'>,
```

**Cause**: `MagicToken` in `convex/lib/token.ts` returns untyped `submissionId`/`senderId`. The token payload type is loose.

### Category B: HTTP/API Response Casting
```typescript
// convex/http.ts:316, 340, 364
id: parseResult.data.id as Id<'scrapedJobs'>,

// convex/inngestNode.ts:24
headers: new Headers(args.headers as Record<string, string>),
```

### Category C: Runtime Type Narrowing Workarounds
```typescript
// convex/inngest/processJob.ts:34
const { event, step, convex } = args as unknown as HandlerArgs;

// src/components/JobMatchResults.tsx:81
return message.parts.filter(isToolPart) as unknown as Array<ToolPartData>
```

### Category D: CSS/React Props
```typescript
// src/components/ui/sonner.tsx:12
theme={theme as ToasterProps["theme"]}

// src/components/ui/chart.tsx:220
} as React.CSSProperties
```

---

## Finding 5: Use of `any`

### In User Code (Non-generated):
```typescript
// scrape-pipeline/lib/typesense.ts:100, 103, 108, 307
} catch (err: any) { // Should be unknown

// scrape-pipeline/transit-scorer.ts:95
[key: string]: any;

// scrape-pipeline/scrapers/snagajob.ts:83, 137, 320
function parseFextures(fextures: any[]): { // Should have proper type
function transformJob(job: any): SnagajobJob { // API response needs type
```

### In Generated Files (Low Priority):
- `convex/_generated/api.d.ts` – 80+ uses (Convex SDK internals, cannot fix)

---

## Finding 6: Profile/Resume Follow Best Practice Already

Good news! These follow the recommended pattern:

- **`src/lib/schemas/profile.ts`** – Zod schema → exports `ProfileFormData`, `ProfileMutationData`
- **`src/lib/schemas/resume.ts`** – Zod schema → exports `ResumeFormData`, `ResumeMutationData`
- **`convex/profiles.ts`** – Uses `zCustomMutation` with the Zod schemas
- **`convex/resumes.ts`** – Uses `zCustomMutation` with the Zod schemas

This is the pattern to replicate for job preferences and job types.

---

# Incremental Refactor Plan

## Phase 1: Low-Risk Quick Wins (1-2 commits)

### Step 1.1: Consolidate `JobMatch` Interface
**Files to change:**
- `src/components/chat/results/JobResultCard.tsx`
- `src/components/JobMatchResults.tsx`

**Action:**
1. Delete both local `JobMatch` interfaces
2. Import from `convex/jobMatcher/schema.ts`:
   ```typescript
   import type { JobMatch } from '../../../convex/jobMatcher/schema'
   ```

**Acceptance:**
- `tsc --noEmit` passes
- Both components render correctly

---

### Step 1.2: Delete Duplicate `TypesenseJobDocument`
**Files to change:**
- `convex/jobMatcher/tools.ts` (delete lines 338-361)

**Action:**
1. Move `TypesenseJobDocument` import from `scrape-pipeline/lib/typesense.ts`
2. Or if cross-project import is complex, re-export from a shared location

**Note:** This may require consideration of Convex deployment boundaries (convex/ can't import from scrape-pipeline/ at runtime).

**Alternative:** Create `convex/lib/typesenseTypes.ts` with the shared interface, import from both places.

---

## Phase 2: Create Shared Job Preferences Schema (1 commit)

### Step 2.1: Define Zod Schema for Job Preferences
**Files to create:**
- `src/lib/schemas/jobPreferences.ts`

**Action:**
```typescript
import { z } from 'zod'

export const jobPreferencesSchema = z.object({
  maxCommuteMinutes: z.union([z.literal(10), z.literal(30), z.literal(60)]).optional(),
  preferEasyApply: z.boolean().optional(),
  preferSecondChance: z.boolean().optional(),
  preferUrgent: z.boolean().optional(),
  requireBusAccessible: z.boolean().optional(),
  requirePublicTransit: z.boolean().optional(),
  requireRailAccessible: z.boolean().optional(),
  requireSecondChance: z.boolean().optional(),
  shiftAfternoon: z.boolean().optional(),
  shiftEvening: z.boolean().optional(),
  shiftFlexible: z.boolean().optional(),
  shiftMorning: z.boolean().optional(),
  shiftOvernight: z.boolean().optional(),
})

export type JobPreferences = z.infer<typeof jobPreferencesSchema>
```

### Step 2.2: Update Consumers
**Files to change:**
- `convex/schema.ts` – Use `zodOutputToConvex(jobPreferencesSchema)` for table
- `convex/jobPreferences.ts` – Delete `jobPreferencesDocValidator`, derive from schema
- `src/components/jobs/FilterSummaryBanner.tsx` – Import `JobPreferences` from schema

**Acceptance:**
- `tsc --noEmit` passes
- `npx convex deploy --typecheck` passes
- Filter UI still works

---

## Phase 3: Unify Scraped Job Types (2-3 commits)

### Step 3.1: Create Base Scraped Job Type
**Files to create:**
- `scrape-pipeline/lib/types/job.ts`

**Action:**
```typescript
export interface BaseScrapedJob {
  id: string
  title: string
  company: string
  pay: string
  payMin?: number
  payMax?: number
  payType?: string
  city?: string
  state?: string
  latitude?: number
  longitude?: number
  description?: string
  descriptionText?: string
  isUrgent: boolean
  isEasyApply: boolean
  applyUrl: string
  postedDate?: string
  jobType?: string
}

export interface SnagajobJob extends BaseScrapedJob {
  // Snagajob-specific fields
  onetCode?: string
  onetTitle?: string
  benefits?: string[]
  skills?: string[]
  // ...
}

export interface CraigslistJob extends BaseScrapedJob {
  // Craigslist-specific fields
  region?: string
  category?: string
  attributes?: Record<string, string>
}
```

### Step 3.2: Update Scrapers
**Files to change:**
- `scrape-pipeline/scrapers/snagajob.ts`
- `scrape-pipeline/scrapers/craigslist.ts`

---

## Phase 4: Fix Type Assertions (3-4 commits)

### Step 4.1: Type `MagicToken` Properly
**Files to change:**
- `convex/lib/token.ts`

**Action:**
Add discriminated union for token types:
```typescript
export type MagicToken = 
  | { type: 'application'; senderId: Id<'senders'>; submissionId: Id<'jobSubmissions'>; exp: number }
  | { type: 'employer'; senderId: Id<'senders'>; exp: number }
```

### Step 4.2: Fix Inngest Handler Type Assertions
**Files to change:**
- `convex/inngest/processJob.ts`
- `convex/inngest/processApplication.ts`
- `convex/inngest/computeIsochrones.ts`

**Action:**
Define proper handler argument types rather than using `as unknown as HandlerArgs`.

### Step 4.3: Replace `any` with `unknown` in Catch Blocks
**Files to change:**
- `scrape-pipeline/lib/typesense.ts`
- All files using `catch (err: any)`

---

## Phase 5: Address Remaining `any` Usage (1-2 commits)

### Step 5.1: Type API Responses
**Files to change:**
- `scrape-pipeline/scrapers/snagajob.ts` – Add types for `ApiResponse.list` items
- `scrape-pipeline/transit-scorer.ts` – Define GTFS stop shape

---

## Acceptance Criteria (Per Phase)

For each phase:
1. **`tsc --noEmit`** – Zero type errors
2. **`bun run lint`** – ESLint passes
3. **`npx convex deploy --typecheck`** – Convex typechecks
4. **Manual smoke test** – Core flows work (job search, profile form, resume form)

---

## What NOT to Change

- **Generated files** (`convex/_generated/*`) – These are Convex SDK internals
- **UI library files** (`src/components/ui/*`) – Shadcn patterns use `as` for CSS props intentionally
- **Import aliasing** (`import * as React from "react"`) – Standard pattern

---

## Summary Table

| Issue | Severity | Effort | Commit Count |
|-------|----------|--------|--------------|
| Duplicate `JobMatch` | High | Low | 1 |
| Duplicate `TypesenseJobDocument` | High | Low | 1 |
| JobPreferences 3x duplication | Medium | Medium | 1 |
| 6+ job type definitions | High | High | 2-3 |
| Token type assertions | Medium | Medium | 1 |
| `any` in catch blocks | Low | Low | 1 |

**Total estimated commits: 7-8**
