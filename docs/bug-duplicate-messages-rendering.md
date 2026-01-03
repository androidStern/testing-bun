# Bug: Duplicate Messages Rendering in Chat UI

## Symptoms

1. **Messages render twice** in the chat UI during a conversation
2. The duplicate content is **identical** - exact same searches, exact same results
3. **Refresh fixes it** - after page refresh, only one instance of each message appears
4. The duplicates appear during the flow when user interacts with interactive tools (askQuestion, collectLocation)

## Screenshot Evidence

- Search results cards appear twice
- Plan component appears twice (out of order - showing up again after results)
- Text summaries appear twice
- All duplicates are byte-for-byte identical

## Relevant Files

- `src/components/chat/JobMatcherRuntimeProvider.tsx` - Runtime provider with `toolResults` state and `convertedMessages` memo
- `src/lib/convexAgentBridge.ts` - Message conversion (contains the bug)
- `convex/jobMatcher/actions.ts` - `submitToolResult` action

## Key Observation

The issue is a **frontend rendering problem**, NOT a backend problem. The backend logs show correct behavior. Refresh eliminates the duplicates, proving the data in Convex is correct.

---

## Investigation Results

### Architecture Overview

The chat UI uses a bridge between two systems:

1. **Convex Agent** (`@convex-dev/agent`) - Backend message storage and AI agent orchestration
2. **assistant-ui** (`@assistant-ui/react`) - Frontend chat UI components

The bridge works as follows:

```
Convex Agent (UIMessage) → convertConvexMessage() → assistant-ui (ThreadMessageLike)
```

### Message Flow for Interactive Tools

When a user interacts with an interactive tool (e.g., `askQuestion`):

1. Agent calls `askQuestion` tool → message saved with `tool-call` part
2. UI renders `QuestionToolUI` in interactive mode (no result yet)
3. User selects an option → `addResult({ selectedOption: ... })` called
4. `handleAddToolResult` in `JobMatcherRuntimeProvider.tsx`:
   - Updates local `toolResults` state (for immediate UI feedback)
   - Calls `submitToolResultAction` (async, saves to Convex)
5. `submitToolResultAction` in `convex/jobMatcher/actions.ts`:
   - Saves a `role: 'tool'` message with `type: 'tool-result'` content
   - Continues the agent thread with `streamText`
6. Agent generates new messages (updated plan, search results, etc.)
7. `useUIMessages` subscription receives all new messages
8. `convertedMessages` memo recalculates with new data

### The Bug Location

**File**: `src/lib/convexAgentBridge.ts`  
**Function**: `convertParts()`  
**Lines**: 168-189

```typescript
// Handle tool call parts (AI SDK uses 'tool-{toolName}' prefix pattern)
if (part.type.startsWith('tool-') || 'toolName' in part) {
  const toolPart = part as {
    type: string
    toolName?: string
    toolCallId?: string
    input?: Record<string, unknown>
    output?: unknown
    state?: string
  }

  // Extract tool name from type (e.g., 'tool-searchJobs' -> 'searchJobs')
  const toolName = toolPart.toolName ?? part.type.replace('tool-', '')

  result.push({
    type: 'tool-call',  // ❌ BUG: Always outputs 'tool-call'
    toolCallId: toolPart.toolCallId ?? `${toolName}-${Date.now()}`,
    toolName,
    args: (toolPart.input ?? {}) as Readonly<Record<string, unknown>>,
    result: toolPart.output,
  } as const)
  continue
}
```

### Root Cause

The condition `part.type.startsWith('tool-')` matches **both**:

| Part Type | What It Is | Matched? |
|-----------|------------|----------|
| `'tool-searchJobs'` | A tool call | ✅ Yes |
| `'tool-askQuestion'` | A tool call | ✅ Yes |
| `'tool-result'` | A tool result | ✅ Yes (BUG!) |

When `submitToolResultAction` saves a tool result to Convex:

```typescript
// From convex/jobMatcher/actions.ts lines 124-137
const { messageId } = await jobMatcherAgent.saveMessage(ctx, {
  message: {
    content: [
      {
        result: args.result,
        toolCallId: args.toolCallId,
        toolName: args.toolName,
        type: 'tool-result',  // <-- This type
      },
    ],
    role: 'tool',
  },
  threadId: args.threadId,
})
```

This message arrives via `useUIMessages`. The `convertParts` function then:

1. Sees `part.type === 'tool-result'`
2. Matches `part.type.startsWith('tool-')` → **true**
3. Converts it to `{ type: 'tool-call', ... }`
4. assistant-ui sees this as a **new tool call**
5. The tool UI (e.g., `SearchJobsToolUI`) renders **again**

### Secondary Issues

#### 1. Wrong Field Mapping for Tool Results

The type assertion assumes tool-call structure:

```typescript
const toolPart = part as {
  input?: Record<string, unknown>  // tool-calls have 'input'
  output?: unknown                  // tool-calls have 'output'
}
```

But `tool-result` parts have different fields:

```typescript
// Actual tool-result structure
{
  type: 'tool-result',
  result: unknown,      // NOT 'output'
  toolCallId: string,
  toolName: string,
}
```

So when converting a tool-result:
- `args` becomes `{}` (because `input` is undefined)
- `result` becomes `undefined` (because `output` is undefined)

#### 2. Incomplete Deduplication

The deduplication logic only covers some tools:

```typescript
// From JobMatcherRuntimeProvider.tsx lines 80-81
const dedupeTools = ['showPlan', 'askQuestion']
```

`searchJobs` is NOT in this list, so if the agent calls `searchJobs` multiple times (or if the bug creates phantom calls), they all render.

### Why Refresh Fixes It

After a page refresh:

1. The `toolResults` local state is cleared (starts as `{}`)
2. Convex Agent's `useUIMessages` returns properly structured `UIMessage` objects
3. The Convex Agent library already handles grouping of tool-calls and tool-results internally
4. The incorrectly-converted phantom tool calls from the previous session are gone

But the core bug remains - new interactions will still trigger duplicates.

### Expected vs Actual Behavior

**Expected** (per assistant-ui documentation):

```typescript
// Messages with role: 'tool' and type: 'tool-result' should be:
// 1. Passed through as-is with correct types
// 2. Automatically matched to their tool-calls by toolCallId
// 3. Grouped together by the runtime

const messages = [
  {
    role: 'assistant',
    content: [{ type: 'tool-call', toolCallId: 'abc', toolName: 'searchJobs', args: {...} }]
  },
  {
    role: 'tool',
    content: [{ type: 'tool-result', toolCallId: 'abc', result: {...} }]  // ✅ Correct
  }
]
```

**Actual** (what our code produces):

```typescript
const messages = [
  {
    role: 'assistant',
    content: [{ type: 'tool-call', toolCallId: 'abc', toolName: 'searchJobs', args: {...} }]
  },
  {
    role: 'tool',
    content: [{ type: 'tool-call', toolCallId: 'abc', toolName: 'result', args: {} }]  // ❌ Wrong!
  }
]
```

---

## Proposed Solution

### Option A: Skip Tool Results (Recommended)

Since assistant-ui automatically matches tool results to their calls, we can skip converting `tool-result` parts entirely. The matching happens by `toolCallId`.

```typescript
// In convertParts(), add this check BEFORE the tool-call handling:

function convertParts(parts: ConvexUIMessage['parts']): readonly ContentPart[] {
  if (!parts || parts.length === 0) {
    return []
  }

  const result: ContentPart[] = []

  for (const part of parts) {
    // Skip internal/implementation parts
    if (INTERNAL_PART_TYPES.has(part.type)) {
      continue
    }

    // NEW: Skip tool-result parts - assistant-ui handles matching automatically
    if (part.type === 'tool-result') {
      continue
    }

    // Handle text parts
    if (part.type === 'text') {
      // ... existing code
    }

    // Handle tool call parts (AI SDK uses 'tool-{toolName}' prefix pattern)
    // Now this only matches actual tool calls like 'tool-searchJobs'
    if (part.type.startsWith('tool-') || 'toolName' in part) {
      // ... existing code
    }

    // ... rest of function
  }

  return result
}
```

### Option B: Proper Tool Result Conversion

If we need to preserve tool results for some reason, convert them correctly:

```typescript
// Add a new content part type
type ToolResultPart = {
  readonly type: 'tool-result'
  readonly toolCallId: string
  readonly toolName: string
  readonly result: unknown
}

type ContentPart = TextPart | ToolCallPart | ToolResultPart

// In convertParts():
if (part.type === 'tool-result') {
  const toolResultPart = part as {
    type: 'tool-result'
    toolCallId: string
    toolName: string
    result: unknown
  }
  
  result.push({
    type: 'tool-result',
    toolCallId: toolResultPart.toolCallId,
    toolName: toolResultPart.toolName,
    result: toolResultPart.result,
  } as const)
  continue
}
```

### Option C: Filter Tool Messages Entirely

Since Convex Agent's `UIMessage` format already groups tool calls with their results, we might not need to pass `role: 'tool'` messages at all:

```typescript
// In JobMatcherRuntimeProvider.tsx, filter out tool messages:
const convertedMessages = useMemo(() => {
  if (!messages?.length) return []

  // Filter out role: 'tool' messages - they're handled by UIMessage grouping
  const filteredMessages = messages.filter(msg => msg.role !== 'tool')
  
  const allConverted = filteredMessages.map((msg, idx) => convertConvexMessage(msg, idx))
  // ... rest of existing logic
}, [messages, toolResults])
```

### Recommended Approach

**Option A** is the cleanest solution because:

1. It's a minimal change (add one condition)
2. It aligns with assistant-ui's documented behavior
3. It doesn't require new type definitions
4. It lets assistant-ui's automatic matching do its job

The fix should also include adding `'tool-result'` to the `INTERNAL_PART_TYPES` set for clarity:

```typescript
const INTERNAL_PART_TYPES = new Set([
  'step-start',
  'step-finish',
  'source',
  'file',
  'tool-result',  // Add this - handled by assistant-ui matching
])
```

---

## Testing Plan

After implementing the fix:

1. **Start a new chat** and trigger an interactive tool (askQuestion or collectLocation)
2. **Submit a response** - verify no duplicate renders
3. **Continue the conversation** - agent should call searchJobs, verify single render
4. **Check plan updates** - showPlan should update in place, not duplicate
5. **Refresh the page** - verify messages still display correctly
6. **Check browser console** - no errors, debug logs show parts being skipped correctly
