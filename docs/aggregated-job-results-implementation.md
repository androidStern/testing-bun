# Aggregated Job Results - Implementation Plan

## Overview

This document details the implementation steps for transforming multiple `searchJobs` tool calls into a single aggregated result with a compact expandable list UI, as specified in `docs/aggregated-job-results-plan.md`.

---

## Current Architecture

### JobMatcherRuntimeProvider.tsx (185 lines)
- Converts Convex Agent messages via `convertConvexMessage()`
- `convertedMessages` useMemo already has transformation logic:
  - Injects tool results from local state
  - Deduplicates certain tools (`showPlan`, `askQuestion`) by keeping only latest
- **This is the ideal place to add the `transformMessageContent` function**

### tools/index.tsx (625 lines)
- Contains `SearchJobsToolUI` using `makeAssistantToolUI<SearchJobsArgs, SearchResult>`
- Each tool UI renders based on `args`, `result`, and `status`
- Exports `jobMatcherToolUIs` array for easy registration

### JobMatcherChat.tsx (184 lines)
- Tool UIs registered as children of `JobMatcherRuntimeProvider`
- Pattern: `<SearchJobsToolUI />` renders inline where assistant-ui places tool calls

### JobResultCard.tsx (224 lines)
- Has `compact` prop for condensed display
- Has `JobResultsList` component but uses cards, not expandable rows

### convexAgentBridge.ts (217 lines)
- Converts Convex Agent parts to assistant-ui format
- Tool calls become `{ type: 'tool-call', toolCallId, toolName, args, result }`

---

## Implementation Steps

### Step 1: Create Type Definitions

**File:** `src/components/chat/tools/AggregatedSearchResults.tsx`

```typescript
interface SearchProvenance {
  query: string
  filters: {
    secondChanceRequired: boolean
    secondChancePreferred: boolean
    busRequired: boolean
    railRequired: boolean
    shifts: string[]
    urgentOnly: boolean
    easyApplyOnly: boolean
  }
  totalFound: number
}

interface AggregatedJob {
  id: string
  title: string
  company: string
  location: string | null
  salary: string | null
  shifts: string[]
  isSecondChance: boolean
  url: string
  matchedBy: SearchProvenance[]
}

interface AggregatedSearchResult {
  jobs: AggregatedJob[]
  searches: SearchProvenance[]
  totalUniqueJobs: number
}

interface AggregatedSearchArgs {
  queries: string[]
  searchCount: number
}
```

---

### Step 2: Implement Transform Function

**File:** `src/components/chat/JobMatcherRuntimeProvider.tsx`

Add `transformMessageContent()` function:

```typescript
function transformMessageContent(
  content: ThreadMessageLike['content']
): ThreadMessageLike['content'] {
  if (!Array.isArray(content)) return content

  // Separate parts by type
  const textParts: Array<{ type: 'text'; text: string }> = []
  const searchJobsCalls: Array<{
    type: 'tool-call'
    toolCallId: string
    toolName: string
    args: Record<string, unknown>
    result?: unknown
  }> = []
  const otherParts: Array<unknown> = []

  for (const part of content) {
    if (part.type === 'text') {
      textParts.push(part)
    } else if (part.type === 'tool-call' && part.toolName === 'searchJobs') {
      searchJobsCalls.push(part)
    } else {
      otherParts.push(part)
    }
  }

  // If 0-1 searchJobs calls, just reorder text first (no aggregation needed)
  if (searchJobsCalls.length <= 1) {
    return [...textParts, ...otherParts, ...searchJobsCalls] as ThreadMessageLike['content']
  }

  // Check if any searches are still running (no result yet)
  const hasRunningSearches = searchJobsCalls.some(call => call.result === undefined)
  if (hasRunningSearches) {
    // Keep original order while searches are running
    return content
  }

  // Aggregate all searchJobs results
  const jobMap = new Map<string, AggregatedJob>()
  const searches: SearchProvenance[] = []

  for (const call of searchJobsCalls) {
    const result = call.result as { jobs?: Array<unknown>; searchContext?: unknown } | undefined
    if (!result) continue

    const searchContext = result.searchContext as {
      query: string
      filters: Record<string, unknown>
      totalFound: number
    } | undefined

    const provenance: SearchProvenance = {
      query: (call.args?.query as string) ?? 'unknown',
      filters: {
        secondChanceRequired: searchContext?.filters?.secondChanceRequired ?? false,
        secondChancePreferred: searchContext?.filters?.secondChancePreferred ?? false,
        busRequired: searchContext?.filters?.busRequired ?? false,
        railRequired: searchContext?.filters?.railRequired ?? false,
        shifts: (searchContext?.filters?.shifts as string[]) ?? [],
        urgentOnly: searchContext?.filters?.urgentOnly ?? false,
        easyApplyOnly: searchContext?.filters?.easyApplyOnly ?? false,
      },
      totalFound: searchContext?.totalFound ?? 0,
    }
    searches.push(provenance)

    const jobs = result.jobs as Array<{
      id: string
      title: string
      company: string
      location: string | null
      salary: string | null
      shifts: string[]
      isSecondChance: boolean
      url: string
    }> | undefined

    for (const job of jobs ?? []) {
      const existing = jobMap.get(job.id)
      if (existing) {
        existing.matchedBy.push(provenance)
      } else {
        jobMap.set(job.id, { ...job, matchedBy: [provenance] })
      }
    }
  }

  // Create synthetic aggregated tool call
  const aggregatedResult: AggregatedSearchResult = {
    jobs: Array.from(jobMap.values()),
    searches,
    totalUniqueJobs: jobMap.size,
  }

  const aggregatedToolCall = {
    type: 'tool-call' as const,
    toolCallId: `aggregated-${searchJobsCalls[0]?.toolCallId ?? Date.now()}`,
    toolName: 'aggregatedSearchResults',
    args: {
      queries: searches.map(s => s.query),
      searchCount: searches.length,
    },
    result: aggregatedResult,
  }

  // Return: text first, then other tools, then aggregated results last
  return [...textParts, ...otherParts, aggregatedToolCall] as ThreadMessageLike['content']
}
```

Apply in `convertedMessages` useMemo after existing dedupe logic:

```typescript
const result = allConverted.map(converted => {
  if (Array.isArray(converted.content)) {
    let updatedContent = converted.content
      .map(part => {
        if (part.type === 'tool-call' && toolResults[part.toolCallId] !== undefined) {
          return { ...part, result: toolResults[part.toolCallId] }
        }
        return part
      })
      .filter(part => {
        if (part.type === 'tool-call' && dedupeTools.includes(part.toolName)) {
          return part.toolCallId === latestToolCallIds[part.toolName]
        }
        return true
      })

    // NEW: Transform to aggregate searchJobs and reorder text first
    updatedContent = transformMessageContent(updatedContent)

    return { ...converted, content: updatedContent }
  }
  return converted
})
```

---

### Step 3: Create AggregatedSearchResultsToolUI Component

**File:** `src/components/chat/tools/AggregatedSearchResults.tsx`

Component structure:

```
AggregatedSearchResultsToolUI (makeAssistantToolUI wrapper)
├── ResultsHeader - "Found 12 jobs from 4 searches"
└── JobList (state: expandedId, showAll)
    ├── JobRow (collapsed) - single line with key info
    │   └── JobRowExpanded (conditional) - details + provenance
    ├── JobRow...
    └── ShowMoreButton (if > 5 jobs)
```

Key behaviors:
- Single accordion expansion (clicking one collapses previous)
- Initially show 5 jobs, "Show X more" reveals rest
- Each row ~44px height collapsed
- Mobile-friendly: truncation, responsive stacking

#### Collapsed Row Layout (~44px)
```
┌─────────────────────────────────────────────────────────────────────┐
│ ▶  Line Cook · Chipotle · Miami, FL · $15-18/hr   ⭐ ☀️🌙  [Apply] │
└─────────────────────────────────────────────────────────────────────┘
```

#### Expanded Row Layout
```
┌─────────────────────────────────────────────────────────────────────┐
│ ▼  Line Cook · Chipotle · Miami, FL · $15-18/hr   ⭐ ☀️🌙  [Apply] │
├─────────────────────────────────────────────────────────────────────┤
│   📍 Miami, FL                                                      │
│   💰 $15 - $18 / hour                                               │
│   ⏰ Morning, Evening shifts                                        │
│   ⭐ Fair Chance Employer                                           │
│   ───────────────────────────────────────────────────────────────   │
│   Found via: "food service cook" · Filters: 30min commute, bus     │
└─────────────────────────────────────────────────────────────────────┘
```

---

### Step 4: Register the Tool UI

**File:** `src/components/chat/tools/index.tsx`

Add export:
```typescript
export { AggregatedSearchResultsToolUI } from './AggregatedSearchResults'
```

**File:** `src/components/chat/JobMatcherChat.tsx`

Add import and registration:
```typescript
import { AggregatedSearchResultsToolUI } from './tools/AggregatedSearchResults'

// Inside JSX:
<AggregatedSearchResultsToolUI />
```

---

### Step 5: Handle Edge Cases

1. **Loading state**: While searches run, keep showing individual `SearchJobsToolUI` progress indicators. Transform only when all searches complete (check `result !== undefined` for all searchJobs parts).

2. **Empty results**: Show empty state with list of queries searched and filters applied.

3. **Single search**: Skip aggregation, but still reorder text before tool call.

4. **Backwards compatibility**: Keep `SearchJobsToolUI` for single searches.

5. **Legacy results**: Handle results without `searchContext` by using fallback values.

---

## File Change Summary

| File | Action | Lines |
|------|--------|-------|
| `src/components/chat/tools/AggregatedSearchResults.tsx` | Create | ~350 |
| `src/components/chat/JobMatcherRuntimeProvider.tsx` | Modify | +80 |
| `src/components/chat/tools/index.tsx` | Modify | +1 |
| `src/components/chat/JobMatcherChat.tsx` | Modify | +2 |

---

## Open Questions

### 1. Loading State Handling
The plan says "individual searchJobs ToolCard progress indicators still show" while running. Options:
- **A**: Leave all in-progress searchJobs as separate cards, replace with aggregated view when all complete ✅ (recommended)
- **B**: Show single "Searching: cook, dishwasher, kitchen prep..." progress card during execution

### 2. Accordion Component
Should we use:
- **A**: Existing `Accordion` from `@/components/ui/accordion` (Radix-based) - may need styling adjustments
- **B**: Custom `useState`-based expansion - more control, simpler for this use case ✅ (recommended)

### 3. Job Ordering
For now, should jobs be ordered by:
- **A**: Order received from searches
- **B**: Number of searches that matched (`matchedBy.length` descending) ✅ (recommended - shows "best" matches first)
- **C**: Alphabetical

### 4. Search Context Availability
Need to verify backend returns `searchContext`. Create fallback for legacy results.

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Performance (deep cloning) | Low | Memoize aggressively if needed |
| Type mismatch with makeAssistantToolUI | Medium | Strict typing, test thoroughly |
| Streaming break | High | Check for undefined results before aggregating |
| Mobile layout issues | Medium | Test on various screen sizes, use truncation |

---

## Testing Checklist

- [ ] Single search: Shows original `SearchJobsToolUI`, text appears before
- [ ] Multiple searches: Aggregates into single view after all complete
- [ ] During search: Individual progress cards show
- [ ] Empty results: Shows queries searched and filters
- [ ] Job deduplication: Same job from multiple searches shows all `matchedBy`
- [ ] Accordion: Only one job expanded at a time
- [ ] Show more: Initially 5 jobs, button reveals rest
- [ ] Mobile: Rows truncate gracefully, Apply button always visible
- [ ] Text ordering: Agent text appears before results
