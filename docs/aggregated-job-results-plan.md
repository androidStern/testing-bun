# Aggregated Job Results UI Plan

## Problem

When the job matcher agent performs multiple searches (e.g., "cook", "dishwasher", "kitchen prep"), each `searchJobs` tool call renders as a **separate card with its own carousel**. This creates:

1. Cluttered, repetitive UI with 3-4 separate panels stacked vertically
2. Agent's text response appears AFTER the tool cards (wrong order)
3. Horizontal carousels with fixed-width cards look ugly and waste space

## Solution

Transform multiple `searchJobs` tool calls into a **single aggregated result** with a **compact expandable list UI**.

### Architecture: Frontend Transform (Option 3)

The transformation happens in `JobMatcherRuntimeProvider.tsx` - our code, not library code. We reshape the message content before assistant-ui sees it.

**Before transform:**
```typescript
// 4 separate tool-call parts + text at end
[
  { type: 'tool-call', toolName: 'searchJobs', args: { query: 'cook' }, result: { jobs: [...] } },
  { type: 'tool-call', toolName: 'searchJobs', args: { query: 'dishwasher' }, result: { jobs: [...] } },
  { type: 'tool-call', toolName: 'searchJobs', args: { query: 'kitchen prep' }, result: { jobs: [...] } },
  { type: 'tool-call', toolName: 'searchJobs', args: { query: 'food service' }, result: { jobs: [...] } },
  { type: 'text', text: 'No food service jobs found with your current filters...' },
]
```

**After transform:**
```typescript
// Text first, then single merged tool-call
[
  { type: 'text', text: 'No food service jobs found with your current filters...' },
  { 
    type: 'tool-call', 
    toolName: 'aggregatedSearchResults',
    args: { queries: ['cook', 'dishwasher', 'kitchen prep', 'food service'], searchCount: 4 },
    result: {
      jobs: [...all jobs merged and deduped with matchedBy provenance...],
      searches: [
        { query: 'cook', filters: {...}, totalFound: 0 },
        { query: 'dishwasher', filters: {...}, totalFound: 0 },
        ...
      ],
      totalUniqueJobs: 12
    }
  },
]
```

Then `AggregatedSearchResultsToolUI` renders the unified compact list view.

---

## Files to Create/Modify

| File | Action |
|------|--------|
| `src/components/chat/JobMatcherRuntimeProvider.tsx` | Modify - add `transformMessageContent` function |
| `src/components/chat/tools/AggregatedSearchResults.tsx` | Create - new tool UI + compact list components |
| `src/components/chat/tools/index.tsx` | Modify - export new tool UI |
| `src/components/chat/JobMatcherChat.tsx` | Modify - register new tool UI |

---

## Types

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
  matchedBy: SearchProvenance[]  // Which searches found this job
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

## UI Design: Compact Expandable List

### Component Structure

```
AggregatedSearchResultsToolUI
├── ResultsHeader (summary: "Found 12 jobs from 4 searches")
└── JobList
    ├── JobRow (collapsed) ──► click to expand
    │   └── JobRowExpanded (details + provenance)
    ├── JobRow (collapsed)
    ├── JobRow (collapsed)
    ├── JobRow (collapsed)
    ├── JobRow (collapsed)
    └── ShowMoreButton (if > 5 jobs)
```

### Collapsed Row (~44px height)

```
┌─────────────────────────────────────────────────────────────────────┐
│ ▶  Line Cook · Chipotle · Miami, FL · $15-18/hr   ⭐ ☀️🌙  [Apply] │
└─────────────────────────────────────────────────────────────────────┘
     │           │          │            │           │   │      │
     │           │          │            │           │   │      └─ Button (always visible)
     │           │          │            │           │   └─ Shift icons
     │           │          │            │           └─ Fair Chance star (if applicable)
     │           │          │            └─ Salary
     │           │          └─ Location
     │           └─ Company
     └─ Job Title (bold)
```

### Expanded Row

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

### Full Widget

```
┌─────────────────────────────────────────────────────────────────────┐
│ 🔍 Found 12 jobs from 4 searches                                    │
├─────────────────────────────────────────────────────────────────────┤
│ ▶ Line Cook · Chipotle · Miami · $15-18/hr            ⭐   [Apply] │
│ ▶ Kitchen Prep · Darden · Ft Lauderdale · $14/hr           [Apply] │
│ ▼ Dishwasher · Marriott · Miami Beach · $13/hr        ⭐   [Apply] │
│   ┌─────────────────────────────────────────────────────────────┐   │
│   │ 📍 Miami Beach, FL                                          │   │
│   │ 💰 $13/hour                                                 │   │
│   │ ⏰ Morning, Evening shifts                                  │   │
│   │ ⭐ Fair Chance Employer                                     │   │
│   │ ─────────────────────────────────────────────────────────── │   │
│   │ Found via: "dishwasher" · Filters: bus, 30min commute      │   │
│   └─────────────────────────────────────────────────────────────┘   │
│ ▶ Food Runner · The Capital Grille · $12/hr                [Apply] │
│ ▶ Prep Cook · Seasons 52 · Coral Gables                    [Apply] │
│                                                                     │
│                         [Show 7 more]                               │
└─────────────────────────────────────────────────────────────────────┘
```

### Empty State

```
┌─────────────────────────────────────────────────────────────────────┐
│ 🔍 No jobs found                                                    │
│ Searched: "cook" · "dishwasher" · "kitchen prep"                    │
│ Filters: 30min commute, bus accessible                              │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Key Behaviors

1. **Accordion expansion**: Only ONE job expanded at a time. Clicking another collapses the previous.

2. **Show more**: Initially show 5 jobs. "Show X more" button reveals the rest.

3. **Text before results**: Transform moves all `text` parts before the synthetic tool call.

4. **Deduplication**: Jobs merged by `id`. Each job tracks all searches that found it in `matchedBy`.

5. **Loading state**: While searches are running, individual `searchJobs` ToolCard progress indicators still show. Once all complete, they get transformed into the aggregated view.

---

## Implementation Details

### 1. Transform Function (JobMatcherRuntimeProvider.tsx)

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
      filters: searchContext?.filters ?? {},
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

### 2. Apply Transform in convertedMessages useMemo

```typescript
const convertedMessages = useMemo(() => {
  // ... existing conversion and dedupe logic ...

  const result = allConverted.map(converted => {
    if (Array.isArray(converted.content)) {
      let updatedContent = converted.content
        // ... existing toolResults injection and dedupe filtering ...

      // NEW: Transform to aggregate searchJobs and reorder text first
      updatedContent = transformMessageContent(updatedContent)

      return { ...converted, content: updatedContent }
    }
    return converted
  })

  return result
}, [messages, toolResults])
```

### 3. AggregatedSearchResultsToolUI Component

Create `src/components/chat/tools/AggregatedSearchResults.tsx` with:

- `AggregatedSearchResultsToolUI` - the makeAssistantToolUI wrapper
- `JobList` - container with show more logic
- `JobRow` - collapsed row component
- `JobRowExpanded` - expanded details + provenance

### 4. Register the Tool UI

In `JobMatcherChat.tsx`, add:

```tsx
<AggregatedSearchResultsToolUI />
```

---

## Mobile Considerations

- Collapsed row should truncate gracefully (title and company get `truncate` class)
- Shift icons may be hidden on very narrow screens
- Apply button stays visible (flex-shrink-0)
- Expanded view stacks vertically, full width

---

## Future Enhancements

- Sort jobs by relevance/match count
- Filter within results (by shift, second-chance, etc.)
- "Save job" functionality
- Keyboard navigation (arrow keys to move, Enter to expand)
