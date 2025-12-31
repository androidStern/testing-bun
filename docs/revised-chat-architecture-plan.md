# Revised: AI Job Search Chat Architecture

## Status: Partially Implemented

This is a revised version of the original chat architecture plan, updated to reflect what's already built in the `claude/transit-isochrones-*` branches and identify remaining work.

---

## Executive Summary

The isochrone branch has already implemented the core AI job search functionality using `@convex-dev/agents`. This revised plan focuses on:
1. **What's already working** (no changes needed)
2. **Gaps to address** (missing features from original plan)
3. **Recommended improvements** (based on real implementation learnings)

---

## Already Implemented (No Changes Needed)

### Backend - Convex Agent

| Component | Status | Location |
|-----------|--------|----------|
| Agent component registration | ✅ Done | `convex/convex.config.ts` |
| Job matcher agent definition | ✅ Done | `convex/jobMatcher/agent.ts` |
| Core tools (resume, prefs, search) | ✅ Done | `convex/jobMatcher/tools.ts` |
| Actions (start, send, cancel) | ✅ Done | `convex/jobMatcher/actions.ts` |
| Message streaming with auth | ✅ Done | `convex/jobMatcher/messages.ts` |
| Search session tracking | ✅ Done | `convex/jobMatcher/queries.ts` |
| Structured output schema | ✅ Done | `convex/jobMatcher/schema.ts` |

### Backend - Transit/Isochrones

| Component | Status | Location |
|-----------|--------|----------|
| Schema (profiles with isochrones) | ✅ Done | `convex/schema.ts` |
| Isochrone compute trigger | ✅ Done | `convex/isochrones.ts` |
| Inngest workflow for Geoapify | ✅ Done | `convex/inngest/computeIsochrones.ts` |
| Geo-filtering utilities | ✅ Done | `convex/lib/geoFilter.ts` |
| Geoapify API client | ✅ Done | `convex/lib/geoapify.ts` |

### Backend - Search Infrastructure

| Component | Status | Location |
|-----------|--------|----------|
| Typesense client setup | ✅ Done | `convex/scrapedJobsSearch.ts` |
| Geo-filtered search action | ✅ Done | `convex/scrapedJobsSearch.ts:searchWithGeo` |
| Shift preference OR filtering | ✅ Done | In searchWithGeo |

### Frontend

| Component | Status | Location |
|-----------|--------|----------|
| JobMatcher (main chat) | ✅ Done | `src/components/JobMatcher.tsx` |
| JobMatchResults (display) | ✅ Done | `src/components/JobMatchResults.tsx` |
| HomeLocationCard | ✅ Done | `src/components/HomeLocationCard.tsx` |
| JobPreferencesForm | ✅ Done | `src/components/JobPreferencesForm.tsx` |
| Filter components | ✅ Done | `src/components/jobs/` |
| Jobs route | ✅ Done | `src/routes/_authenticated/jobs.tsx` |

### Schema Tables

| Table | Status | Purpose |
|-------|--------|---------|
| `jobSearches` | ✅ Done | Tracks active/completed searches per user |
| `jobPreferences` | ✅ Done | User job search preferences |
| `profiles.isochrones` | ✅ Done | GeoJSON transit zones |
| `profiles.homeLat/homeLon` | ✅ Done | User home location |

---

## Implementation Differences from Original Plan

### 1. Frontend Pattern (Good Difference)

**Original Plan:** Vercel AI SDK UI (`useChat`) + AI Elements + custom transport

**Actual Implementation:** Convex Agent's `useUIMessages` hook + custom components

**Why this is better:**
- Native Convex reactivity (survives disconnects, multi-tab sync)
- No custom transport layer needed
- Simpler mental model for your stack
- `SmoothText` component included for streaming text

**Recommendation:** Keep the current approach. No migration needed.

### 2. Model Choice (Optimization)

**Original Plan:** Anthropic Claude Sonnet

**Actual Implementation:** Groq `moonshotai/kimi-k2-instruct-0905`

**Trade-offs:**
- ✅ Groq is faster (lower latency)
- ✅ Groq is cheaper per token
- ⚠️ Kimi K2 may have different reasoning quality
- ⚠️ Tool calling reliability may differ

**Recommendation:** Test with Claude as a fallback option. Add model switching capability:

```typescript
// convex/jobMatcher/agent.ts
const model = process.env.USE_CLAUDE === 'true'
  ? anthropic('claude-sonnet-4-20250514')
  : groq('moonshotai/kimi-k2-instruct-0905')
```

### 3. Tool Architecture (Simplified)

**Original Plan:** 7+ tools including `promptUserInput`, `presentJobs`, `updateSearchCriteria`

**Actual Implementation:** 3 tools + `generateObject` for structured output

| Original Tool | Current Status | Notes |
|---------------|----------------|-------|
| `searchJobs` | ✅ Implemented | Works well |
| `getUserResume` → `getMyResume` | ✅ Implemented | Security-hardened with ctx.userId |
| `getUserPreferences` → `getMyJobPreferences` | ✅ Implemented | Includes transit zone info |
| `promptUserInput` | ❌ Not implemented | See Gap #1 below |
| `presentJobs` | ❌ Replaced | Using `generateObject` instead |
| `updateSearchCriteria` | ❌ Not implemented | See Gap #2 below |
| `checkTransitAccessibility` | ⚠️ Partial | Baked into `searchJobs` |
| `generateTailoredResume` | ❌ Future | Per original plan |

---

## Gaps to Address

### Gap 1: Interactive UI Prompts (`promptUserInput`)

**Issue:** The agent can't prompt the user for structured input (location picker, preference selector) mid-conversation.

**Current behavior:** Agent asks text questions, user responds with text.

**Desired behavior:** Agent triggers a UI component that collects structured data.

**Recommended Implementation:**

```typescript
// convex/jobMatcher/tools.ts

export const requestUserAction = createTool({
  args: z.object({
    actionType: z.enum(['set_location', 'update_preferences', 'confirm_search']),
    message: z.string(),
    context: z.record(z.unknown()).optional(),
  }),
  description: `Request the user to perform an action via UI. Use this when:
- User hasn't set their home location (actionType: 'set_location')
- User's preferences are missing or need updating (actionType: 'update_preferences')
- You want to confirm search parameters before proceeding (actionType: 'confirm_search')`,
  handler: async (_ctx, args) => {
    // This returns data that the frontend renders as a special UI component
    return {
      type: 'user_action_required',
      actionType: args.actionType,
      message: args.message,
      context: args.context,
    }
  },
})
```

**Frontend handling in `JobMatchResults.tsx`:**

```typescript
// In renderMessageParts or similar
if (part.toolName === 'requestUserAction' && part.output?.type === 'user_action_required') {
  const { actionType, message } = part.output

  switch (actionType) {
    case 'set_location':
      return <HomeLocationCard key={idx} message={message} />
    case 'update_preferences':
      return <JobPreferencesForm key={idx} message={message} compact />
    case 'confirm_search':
      return <SearchConfirmation key={idx} message={message} />
  }
}
```

### Gap 2: Search Criteria Persistence

**Issue:** The original plan had a `searchSessions` table with per-thread criteria. Current implementation stores preferences globally in `jobPreferences`, not per-search.

**Current behavior:** Preferences apply globally to all searches.

**Desired behavior (optional):** Each search thread can have its own refined criteria.

**Recommendation:** This is lower priority. The current global preferences approach is simpler and works well. Only add per-thread criteria if users complain about losing context.

### Gap 3: Chat History & Conversation UI

**Issue:** The current `JobMatcher` component focuses on single searches. There's no conversation history view or ability to review past searches easily.

**Current behavior:** One active search at a time, past searches are "cancelled" or "completed."

**Recommended additions:**

1. **Search history drawer:**
```typescript
// src/components/SearchHistory.tsx
export function SearchHistory() {
  const searches = useQuery(api.jobMatcher.queries.listSearches, {})

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon">
          <History className="h-5 w-5" />
        </Button>
      </SheetTrigger>
      <SheetContent>
        {searches?.map(search => (
          <SearchHistoryItem
            key={search._id}
            search={search}
            onResume={() => /* resume thread */}
          />
        ))}
      </SheetContent>
    </Sheet>
  )
}
```

2. **Thread resume capability:**
```typescript
// Already supported! Use startSearch with existing threadId
await startSearchAction({
  prompt: 'Continue my previous search',
  threadId: existingSearch.threadId,
})
```

### Gap 4: Error Recovery & Edge Cases

**Issues identified:**
- No handling for Typesense connection failures
- No graceful degradation if isochrone computation fails
- Agent may loop if resume/preferences are missing

**Recommended fixes:**

```typescript
// convex/jobMatcher/tools.ts - In searchJobs handler

// Add retry logic for Typesense
try {
  const searchResults = await ctx.runAction(internal.scrapedJobsSearch.searchWithGeo, args)
  // ...
} catch (error) {
  // Return helpful error instead of crashing
  return {
    error: 'search_unavailable',
    message: 'Job search is temporarily unavailable. Please try again.',
    fallbackSuggestion: 'Try updating your preferences and searching again.'
  }
}
```

```typescript
// Agent instructions update
instructions: `...
## Error Handling

If searchJobs fails, explain the issue and ask the user to try again.
If no resume exists, still search - use generic queries like "*" or ask what they're looking for.
If no home location is set and they want transit filtering, ask them to set it first.
...`
```

---

## Recommended Next Steps (Priority Order)

### P0: Critical for Launch

1. **Test the current implementation end-to-end**
   - Create test user with resume, preferences, home location
   - Verify isochrone computation works
   - Run multiple searches and check results quality
   - Test follow-up conversations

2. **Add `requestUserAction` tool** (Gap #1)
   - Allows agent to prompt for missing data
   - Improves onboarding flow for new users

### P1: Important but Not Blocking

3. **Add model fallback/selection**
   - Support both Groq and Claude
   - Add env var to switch
   - Compare quality/latency

4. **Improve error handling** (Gap #4)
   - Graceful Typesense failures
   - Better agent instructions for edge cases

5. **Search history UI** (Gap #3)
   - Let users review past searches
   - Resume conversations

### P2: Nice to Have

6. **Per-thread search criteria** (Gap #2)
   - Only if users complain about losing context

7. **AI Elements integration**
   - Could improve chat UI aesthetics
   - Not required - current components work

8. **Tailored resume generation**
   - Original plan's future feature
   - Significant scope - defer to later phase

---

## Architecture Diagram (Current State)

```
┌─────────────────────────────────────────────────────────────────────┐
│                         TanStack Start Frontend                     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌───────────────────────┐    ┌─────────────────────────────────┐   │
│  │   useUIMessages       │    │     Custom Components           │   │
│  │  (@convex-dev/agent)  │    │  - JobMatchResults              │   │
│  │                       │    │  - JobCard                      │   │
│  │  - Thread messages    │    │  - HomeLocationCard             │   │
│  │  - Streaming status   │    │  - JobPreferencesForm           │   │
│  │  - Tool call parts    │    │  - FilterDrawer                 │   │
│  └───────────┬───────────┘    └─────────────────────────────────┘   │
│              │                              ▲                        │
│              │              Renders tool.output as UI               │
│              ▼                              │                        │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │         JobMatcher.tsx (Main Chat Component)                 │   │
│  │  - startSearchAction() → new thread + streamText             │   │
│  │  - sendMessageAction() → continue thread + streamText        │   │
│  │  - cancelSearchAction() → mark completed                     │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
                                    │
                          Convex WebSocket (Reactive)
                                    │
                                    ▼
┌──────────────────────────────────────────────────────────────────────┐
│                          Convex Backend                              │
├──────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  ┌─────────────────────────────────────────────────────────────────┐ │
│  │               @convex-dev/agents (Job Matcher)                  │ │
│  │                                                                   │ │
│  │  Model: Groq kimi-k2-instruct-0905                               │ │
│  │  maxSteps: 10                                                     │ │
│  │                                                                   │ │
│  │  Tools:                                                          │ │
│  │  ├─ getMyResume (ctx.userId secured)                            │ │
│  │  ├─ getMyJobPreferences (includes transit zone status)          │ │
│  │  └─ searchJobs (auto-filters by isochrone + preferences)        │ │
│  │                                                                   │ │
│  │  Workflow:                                                       │ │
│  │  1. streamText() → tools run, UI shows progress                 │ │
│  │  2. generateObject() → structured JobResults                    │ │
│  └─────────────────────────────────────────────────────────────────┘ │
│                                                                       │
│  ┌────────────────────────┐    ┌────────────────────────────────┐   │
│  │   jobSearches table    │    │   jobPreferences table         │   │
│  │   - threadId           │    │   - shiftMorning/Afternoon/etc │   │
│  │   - status             │    │   - maxCommuteMinutes          │   │
│  │   - workosUserId       │    │   - requireSecondChance        │   │
│  │   - initialPrompt      │    │   - requirePublicTransit       │   │
│  └────────────────────────┘    └────────────────────────────────┘   │
│                                                                       │
│  ┌─────────────────────────────────────────────────────────────────┐ │
│  │           Inngest Workflows (Background Processing)             │ │
│  │                                                                   │ │
│  │  computeIsochrones:                                              │ │
│  │  1. fetchIsochrones() → Geoapify API                            │ │
│  │  2. pollIsochrones() → if async                                 │ │
│  │  3. saveIsochrones() → profiles.isochrones                      │ │
│  └─────────────────────────────────────────────────────────────────┘ │
│                                                                       │
└──────────────────────────────────────────────────────────────────────┘
                        │                    │
                        ▼                    ▼
              ┌─────────────────┐   ┌─────────────────┐
              │    Typesense    │   │   Convex Tables │
              │   (Job Search)  │   │  - profiles     │
              │                 │   │  - resumes      │
              │  searchWithGeo  │   │  - jobSearches  │
              │  - geo filter   │   │  - jobPrefs     │
              │  - shift OR     │   │                 │
              │  - facets       │   │                 │
              └─────────────────┘   └─────────────────┘
                        │
              ┌─────────────────┐
              │    Geoapify     │
              │  (Isochrones)   │
              │                 │
              │  10/30/60 min   │
              │  transit zones  │
              └─────────────────┘
```

---

## Key Files Reference

### Backend (Convex)

```
convex/
├── convex.config.ts          # Agent component registration
├── schema.ts                 # All tables including jobSearches, jobPreferences
├── isochrones.ts             # Trigger isochrone computation
├── scrapedJobsSearch.ts      # Typesense search actions
├── jobMatcher/
│   ├── agent.ts              # Agent definition
│   ├── tools.ts              # getMyResume, getMyJobPreferences, searchJobs
│   ├── actions.ts            # startSearch, sendMessage, cancelSearch
│   ├── queries.ts            # getActiveSearch, listSearches
│   ├── messages.ts           # listThreadMessages (auth-protected)
│   └── schema.ts             # Zod schemas for JobMatch, JobResults
├── inngest/
│   └── computeIsochrones.ts  # Geoapify workflow
└── lib/
    ├── geoFilter.ts          # filterByIsochrone, isPointInIsochrone
    └── geoapify.ts           # API client
```

### Frontend (TanStack Start)

```
src/
├── routes/
│   └── _authenticated/
│       └── jobs.tsx          # Main jobs page
└── components/
    ├── JobMatcher.tsx        # Main chat component
    ├── JobMatchResults.tsx   # Results + tool activity display
    ├── HomeLocationCard.tsx  # Location setter
    ├── JobPreferencesForm.tsx# Preferences form
    └── jobs/
        ├── FilterDrawer.tsx
        ├── FilterCategoryRow.tsx
        ├── FilterSummaryBanner.tsx
        └── index.ts
```

---

## Comparison: Original Plan vs Current Implementation

| Aspect | Original Plan | Current Implementation | Verdict |
|--------|---------------|----------------------|---------|
| Agent Framework | Convex Agent | Convex Agent | ✅ Same |
| Frontend State | AI SDK UI `useChat` | Convex `useUIMessages` | ✅ Better |
| Model | Claude Sonnet | Groq Kimi K2 | ⚠️ Test both |
| Tool Count | 7+ | 3 + generateObject | ✅ Simpler |
| Streaming | Custom transport | WebSocket deltas | ✅ Better |
| Structured Output | Tool return | generateObject | ✅ Better |
| User Prompts | `promptUserInput` tool | Not implemented | ❌ Add this |
| Search Criteria | Per-thread state | Global preferences | ✅ Simpler |
| Chat History | Not specified | Basic (listSearches) | ⚠️ Improve UI |

---

## Conclusion

The isochrone branch implementation is solid and aligns well with the original plan's goals. The main differences are simplifications that make the system easier to maintain.

**Immediate action items:**
1. Merge/test the isochrone branch on development
2. Add `requestUserAction` tool for better onboarding
3. Consider Claude as model option for quality comparison

**The architecture is ready for production use** with minor enhancements.
