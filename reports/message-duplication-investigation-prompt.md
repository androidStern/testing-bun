# EXHAUSTIVE INVESTIGATION: Message Duplication Bug in Convex Agent + assistant-ui Integration

## Mission Statement
Produce a complete, evidence-based technical analysis of how messages flow from LLM response through Convex Agent to assistant-ui rendering. The goal is to understand **with certainty** (not speculation) exactly why tool calls (especially `showPlan`) render multiple times during streaming and after page reload.

**CRITICAL**: Do NOT propose fixes until the root cause is identified with concrete evidence. Do NOT guess. If something is unclear, document what would need to be tested empirically.

---

## PART 1: SOURCE CODE ANALYSIS

### 1.1 Convex Agent Backend Internals
Read and document EVERY file below. For each file, extract:
- Data structures and their fields
- Functions and their behavior
- How state changes over time
- Any comments or documentation

**Database Schema & Storage:**
```
node_modules/@convex-dev/agent/src/component/schema.ts
node_modules/@convex-dev/agent/src/component/messages.ts
node_modules/@convex-dev/agent/src/component/streams.ts
node_modules/@convex-dev/agent/src/component/threads.ts
```

**Message Transformation & Mapping:**
```
node_modules/@convex-dev/agent/src/UIMessages.ts
node_modules/@convex-dev/agent/src/mapping.ts
node_modules/@convex-dev/agent/src/deltas.ts
node_modules/@convex-dev/agent/src/validators.ts
node_modules/@convex-dev/agent/src/shared.ts
```

**Client-Side Agent Logic:**
```
node_modules/@convex-dev/agent/src/client/streaming.ts
node_modules/@convex-dev/agent/src/client/streamText.ts
node_modules/@convex-dev/agent/src/client/messages.ts
node_modules/@convex-dev/agent/src/client/threads.ts
node_modules/@convex-dev/agent/src/client/types.ts
node_modules/@convex-dev/agent/src/client/index.ts
```

**React Hooks:**
```
node_modules/@convex-dev/agent/src/react/useUIMessages.ts
node_modules/@convex-dev/agent/src/react/useStreamingUIMessages.ts
node_modules/@convex-dev/agent/src/react/useDeltaStreams.ts
node_modules/@convex-dev/agent/src/react/useThreadMessages.ts
node_modules/@convex-dev/agent/src/react/types.ts
node_modules/@convex-dev/agent/src/react/index.ts
```

**Test Files (reveal expected behavior):**
```
node_modules/@convex-dev/agent/src/UIMessages.test.ts
node_modules/@convex-dev/agent/src/mapping.test.ts
node_modules/@convex-dev/agent/src/deltas.test.ts
node_modules/@convex-dev/agent/src/react/useUIMessages.test.ts
node_modules/@convex-dev/agent/src/component/messages.test.ts
```

**Document these specific questions:**
1. What is the exact database schema for messages? What indexes exist?
2. When `streamText()` is called, what records are created/updated?
3. What determines when `order` increments vs when `stepOrder` increments?
4. How does `syncStreams` work? What does it return?
5. How does `listUIMessages` fetch and transform data?
6. How are tool calls stored? As separate messages or parts within messages?
7. How are tool results stored? Same message or different?
8. What does the `key` field represent? How is it constructed?
9. During streaming, are existing records mutated or are new records inserted?
10. After streaming completes, what is the final state of records?

### 1.2 assistant-ui Runtime Internals
Read and document EVERY file below:

**External Store Runtime (CRITICAL):**
```
node_modules/@assistant-ui/react/src/legacy-runtime/runtime-cores/external-store/useExternalStoreRuntime.tsx
node_modules/@assistant-ui/react/src/legacy-runtime/runtime-cores/external-store/ExternalStoreAdapter.tsx
node_modules/@assistant-ui/react/src/legacy-runtime/runtime-cores/external-store/ExternalStoreRuntimeCore.tsx
node_modules/@assistant-ui/react/src/legacy-runtime/runtime-cores/external-store/ExternalStoreThreadRuntimeCore.tsx
node_modules/@assistant-ui/react/src/legacy-runtime/runtime-cores/external-store/ThreadMessageLike.tsx
node_modules/@assistant-ui/react/src/legacy-runtime/runtime-cores/external-store/ThreadMessageConverter.ts
node_modules/@assistant-ui/react/src/legacy-runtime/runtime-cores/external-store/external-message-converter.tsx
node_modules/@assistant-ui/react/src/legacy-runtime/runtime-cores/external-store/createMessageConverter.tsx
node_modules/@assistant-ui/react/src/legacy-runtime/runtime-cores/external-store/getExternalStoreMessage.tsx
node_modules/@assistant-ui/react/src/legacy-runtime/runtime-cores/external-store/auto-status.tsx
```

**Message Repository (message identity tracking):**
```
node_modules/@assistant-ui/react/src/legacy-runtime/runtime-cores/utils/MessageRepository.tsx
node_modules/@assistant-ui/react/src/tests/MessageRepository.test.ts
```

**Thread & Message Rendering:**
```
node_modules/@assistant-ui/react/src/primitives/thread/ThreadMessages.tsx
node_modules/@assistant-ui/react/src/primitives/message/MessageParts.tsx
node_modules/@assistant-ui/react/src/context/providers/MessageProvider.tsx
node_modules/@assistant-ui/react/src/context/providers/MessageByIndexProvider.tsx
node_modules/@assistant-ui/react/src/context/providers/PartByIndexProvider.tsx
```

**Tool UI System:**
```
node_modules/@assistant-ui/react/src/model-context/makeAssistantToolUI.tsx
node_modules/@assistant-ui/react/src/model-context/useAssistantToolUI.tsx
node_modules/@assistant-ui/react/src/model-context/tool.ts
node_modules/@assistant-ui/react/src/model-context/toolbox.tsx
node_modules/@assistant-ui/react/src/client/Tools.ts
```

**Types:**
```
node_modules/@assistant-ui/react/src/types/MessagePartTypes.ts
node_modules/@assistant-ui/react/src/client/types/Message.ts
node_modules/@assistant-ui/react/src/client/types/Part.ts
```

**Document these specific questions:**
1. How does `useExternalStoreRuntime` track message identity?
2. What happens when a message's ID changes between renders?
3. How does `MessageRepository` deduplicate or manage messages?
4. What is `ThreadMessageLike`'s exact structure for tool calls?
5. How are tool-call parts matched with tool-result parts?
6. What triggers the "Tool result without preceding tool call" warning? (Find the exact source)
7. How does `makeAssistantToolUI` render tool UIs? When does it re-render?
8. What is `joinStrategy` and how does it affect message grouping?

### 1.3 Our Implementation
Read and analyze EVERY file:

**Backend:**
```
convex/jobMatcher/messages.ts
convex/jobMatcher/actions.ts
convex/jobMatcher/tools.ts
convex/jobMatcher/agent.ts
convex/jobMatcher/queries.ts
convex/jobMatcher/schema.ts
convex/jobMatcher/index.ts
```

**Frontend Bridge:**
```
src/lib/convexAgentBridge.ts
src/components/chat/JobMatcherRuntimeProvider.tsx
```

**UI Components:**
```
src/components/chat/JobMatcherChat.tsx
src/components/chat/tools/index.tsx
src/components/chat/tools/ToolProgress.tsx
src/components/chat/tools/OptionList.tsx
src/components/chat/tools/LocationSetupCard.tsx
src/components/assistant-ui/thread.tsx
src/components/assistant-ui/tool-fallback.tsx
src/components/tool-ui/plan/plan.tsx
src/components/tool-ui/plan/schema.ts
src/components/tool-ui/plan/index.tsx
```

**Document:**
1. How does `listThreadMessages` query messages?
2. What does the canonicalization logic in `JobMatcherRuntimeProvider` do?
3. How does `convertConvexMessage` transform messages?
4. What parts are filtered out in `convertParts`? Why?
5. How are tool UIs registered and rendered?

---

## PART 2: DATA FLOW TRACING

### 2.1 Complete Architecture Diagram
Create a detailed Mermaid diagram showing:
```
┌─────────────────────────────────────────────────────────────────────────┐
│ LLM Response                                                             │
│ (tool calls, text, etc.)                                                │
└────────────────────────────────────┬────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ Convex Agent Backend                                                     │
│ - streamText() processing                                               │
│ - Message storage (schema, indexes)                                     │
│ - Stream delta handling                                                 │
└────────────────────────────────────┬────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ Convex Database                                                          │
│ - Messages table structure                                              │
│ - Streams table structure                                               │
│ - What gets stored when                                                 │
└────────────────────────────────────┬────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ listThreadMessages Query                                                 │
│ - listUIMessages call                                                   │
│ - syncStreams call                                                      │
│ - What is returned                                                      │
└────────────────────────────────────┬────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ useUIMessages Hook                                                       │
│ - Pagination handling                                                   │
│ - Stream merging                                                        │
│ - What React receives                                                   │
└────────────────────────────────────┬────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ JobMatcherRuntimeProvider                                                │
│ - Canonicalization logic                                                │
│ - Message conversion                                                    │
│ - Runtime creation                                                      │
└────────────────────────────────────┬────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ convexAgentBridge                                                        │
│ - convertConvexMessage()                                                │
│ - convertParts()                                                        │
│ - ID assignment                                                         │
└────────────────────────────────────┬────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ useExternalStoreRuntime                                                  │
│ - Message identity tracking                                             │
│ - MessageRepository usage                                               │
│ - Runtime state                                                         │
└────────────────────────────────────┬────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ assistant-ui Components                                                  │
│ - ThreadPrimitive.Messages                                              │
│ - MessagePrimitive.Parts                                                │
│ - Tool UI rendering                                                     │
└────────────────────────────────────┬────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ React DOM                                                                │
│ - What gets rendered                                                    │
│ - Why duplicates appear                                                 │
└─────────────────────────────────────────────────────────────────────────┘
```

At EACH stage, document:
- Exact data structure (with field names and types)
- Transformations applied
- Where duplication could be introduced

### 2.2 Message Lifecycle Traces
Trace these specific scenarios end-to-end:

**Scenario A: showPlan Tool Call**
1. Agent calls showPlan with id="job-search-plan", title="Finding jobs for you"
2. Trace what records are created in database
3. Trace what useUIMessages returns
4. Trace what bridge produces
5. Trace what assistant-ui renders
6. Show actual field values at each step

**Scenario B: Multiple Tool Calls in One Turn**
1. Agent calls showPlan, then getMyResume, then getMyJobPreferences
2. How are these stored? Same message? Different messages?
3. What are the order/stepOrder values for each?
4. How does the UI receive and render them?

**Scenario C: showPlan Updates**
1. Agent calls showPlan with status="in_progress" for first todo
2. Agent later calls showPlan with status="completed" for first todo
3. Are these stored as updates or new records?
4. What does the UI see at each point?

**Scenario D: Interactive Tool (askQuestion)**
1. Agent calls askQuestion
2. User clicks an option
3. submitToolResult is called
4. Agent continues with new message
5. How are tool-call and tool-result connected?

**Scenario E: Page Reload**
1. User reloads page after partial conversation
2. What does listThreadMessages return?
3. Are there duplicate records in the database?
4. Why do duplicates appear in UI?

### 2.3 Streaming Timeline
Document what happens at each millisecond during streaming:

```
T+0ms:    User sends message
T+100ms:  startSearch action called
T+200ms:  thread.streamText() begins
T+300ms:  First streaming delta received
          - What record exists?
          - What does useUIMessages return?
T+500ms:  showPlan tool call starts
          - What record(s) created?
          - order=? stepOrder=?
T+600ms:  showPlan tool call completes
          - Record updated or new record?
T+700ms:  getMyResume tool call starts
          - What record(s)?
          - Same order or different?
T+1000ms: Text chunk received
T+1500ms: Stream ends
          - Final database state?
          - What useUIMessages returns?
```

---

## PART 3: DEBUG LOGGING IMPLEMENTATION

Add comprehensive debug logging to trace the issue live.

**Requirements:**
1. ALL logs MUST be prefixed with `[MSGDUPE]` for easy Chrome DevTools filtering
2. ALL logged values MUST be strings (use JSON.stringify for objects)
3. Logs must be copy-pasteable (no [object Object])
4. Include timestamps for timing analysis
5. Include React render counts
6. Include component mount/unmount tracking

### 3.1 Logging in JobMatcherRuntimeProvider.tsx

```typescript
// At component mount
useEffect(() => {
  console.log('[MSGDUPE] JobMatcherRuntimeProvider MOUNTED threadId=' + threadId)
  return () => {
    console.log('[MSGDUPE] JobMatcherRuntimeProvider UNMOUNTED threadId=' + threadId)
  }
}, [threadId])

// After useUIMessages returns
const renderCountRef = useRef(0)
renderCountRef.current++
console.log('[MSGDUPE] useUIMessages render=' + renderCountRef.current + ' status=' + paginationStatus + ' rawCount=' + (messages?.length ?? 0))

if (messages?.length) {
  // Log raw message details
  const rawSummary = messages.map(m => 
    'order=' + m.order + 
    ' step=' + m.stepOrder + 
    ' key=' + m.key + 
    ' role=' + m.role +
    ' parts=' + (m.parts?.length ?? 0) +
    ' status=' + m.status
  ).join(' | ')
  console.log('[MSGDUPE] raw messages: ' + rawSummary)
  
  // Log tool call details
  const toolCalls = messages.flatMap(m => 
    (m.parts ?? [])
      .filter(p => p.type.startsWith('tool-') || 'toolName' in p)
      .map(p => 'msgOrder=' + m.order + ' type=' + p.type + ' toolCallId=' + (p.toolCallId ?? 'none'))
  )
  if (toolCalls.length) {
    console.log('[MSGDUPE] raw tool calls: ' + toolCalls.join(' | '))
  }
}

// After canonicalization
console.log('[MSGDUPE] post-canon count=' + canonicalMessages.length)
const canonSummary = canonicalMessages.map(m => 
  'order=' + m.order + ' step=' + m.stepOrder
).join(' | ')
console.log('[MSGDUPE] canonical orders: ' + canonSummary)

// After conversion
console.log('[MSGDUPE] converted count=' + convertedMessages.length)
const convertedSummary = convertedMessages.map(m => {
  const toolParts = Array.isArray(m.content) 
    ? m.content.filter(p => p.type === 'tool-call').map(p => p.toolName + ':' + p.toolCallId)
    : []
  return 'id=' + m.id + ' tools=' + (toolParts.length ? toolParts.join(',') : 'none')
}).join(' | ')
console.log('[MSGDUPE] converted messages: ' + convertedSummary)
```

### 3.2 Logging in convexAgentBridge.ts

```typescript
// In convertConvexMessage
export function convertConvexMessage(msg: ConvexUIMessage): ThreadMessageLike {
  console.log('[MSGDUPE] convertConvexMessage input: order=' + msg.order + ' step=' + msg.stepOrder + ' key=' + msg.key + ' partsCount=' + (msg.parts?.length ?? 0))
  
  const content = convertParts(msg.parts)
  
  const toolCallsInContent = content.filter(p => p.type === 'tool-call')
  console.log('[MSGDUPE] convertConvexMessage output: id=' + String(msg.order) + ' contentParts=' + content.length + ' toolCalls=' + toolCallsInContent.length)
  
  if (toolCallsInContent.length) {
    const tcSummary = toolCallsInContent.map(tc => tc.toolName + ':' + tc.toolCallId).join(',')
    console.log('[MSGDUPE] tool calls in output: ' + tcSummary)
  }
  
  // ... rest of function
}

// In convertParts
function convertParts(parts: ConvexUIMessage['parts']): readonly ContentPart[] {
  if (!parts || parts.length === 0) {
    return []
  }
  
  console.log('[MSGDUPE] convertParts input: ' + parts.map(p => p.type).join(','))
  
  const result: ContentPart[] = []
  const skipped: string[] = []
  
  for (const part of parts) {
    if (INTERNAL_PART_TYPES.has(part.type)) {
      skipped.push(part.type)
      continue
    }
    // ... rest of processing
  }
  
  if (skipped.length) {
    console.log('[MSGDUPE] convertParts skipped: ' + skipped.join(','))
  }
  console.log('[MSGDUPE] convertParts output: ' + result.map(p => p.type).join(','))
  
  return result
}
```

### 3.3 Logging in ShowPlanToolUI (tools/index.tsx)

```typescript
export const ShowPlanToolUI = makeAssistantToolUI<ShowPlanArgs, ShowPlanArgs>({
  render: ({ args, result, status }) => {
    // Log every render
    const plan = result ?? args
    console.log('[MSGDUPE] ShowPlanToolUI RENDER: planId=' + (plan?.id ?? 'none') + ' title=' + (plan?.title ?? 'none') + ' todosCount=' + (plan?.todos?.length ?? 0) + ' status=' + JSON.stringify(status))
    
    if (!plan?.todos) {
      console.log('[MSGDUPE] ShowPlanToolUI returning null - no todos')
      return null
    }

    return (
      <Plan
        description={plan.description}
        id={plan.id}
        showProgress
        title={plan.title}
        todos={plan.todos}
      />
    )
  },
  toolName: 'showPlan',
})
```

### 3.4 Logging in Plan Component (tool-ui/plan/plan.tsx)

```typescript
export function Plan({ id, title, todos, ...props }: PlanProps) {
  const renderCountRef = useRef(0)
  renderCountRef.current++
  
  useEffect(() => {
    console.log('[MSGDUPE] Plan MOUNTED: id=' + id + ' title=' + title)
    return () => {
      console.log('[MSGDUPE] Plan UNMOUNTED: id=' + id)
    }
  }, [id, title])
  
  console.log('[MSGDUPE] Plan RENDER #' + renderCountRef.current + ': id=' + id + ' title=' + title + ' todosCount=' + todos.length)
  
  // ... rest of component
}
```

### 3.5 Logging for Other Tool UIs

Add similar logging to:
- ResumeToolUI
- PreferencesToolUI
- SearchJobsToolUI
- QuestionToolUI
- CollectLocationToolUI

Pattern:
```typescript
console.log('[MSGDUPE] <ToolName>ToolUI RENDER: status=' + status.type + ' hasResult=' + !!result + ' hasArgs=' + !!args)
```

### 3.6 Add React DevTools Integration (Optional)

```typescript
// In JobMatcherRuntimeProvider
useEffect(() => {
  // @ts-ignore - React DevTools hook
  if (window.__REACT_DEVTOOLS_GLOBAL_HOOK__) {
    console.log('[MSGDUPE] React DevTools detected')
  }
}, [])
```

---

## PART 4: DELIVERABLES

### Deliverable 1: Investigation Report
**File: `reports/message-duplication-investigation.md`**

Contents:
1. Executive Summary (1 paragraph)
2. Architecture Diagram (Mermaid)
3. Message Lifecycle Traces (all scenarios)
4. Streaming Timeline
5. Root Cause Analysis
   - The exact mechanism causing duplicates
   - Evidence from source code
   - Evidence from data traces
6. Why Current Canonicalization Fails
7. Recommended Fix (only if root cause is certain)

### Deliverable 2: Context File
**File: `reports/message-duplication-context.md`**

Contents:
1. Key Type Definitions (from all relevant source files)
2. Critical Code Snippets (with file paths and line numbers)
3. Database Schema (from Convex Agent)
4. Message Format Examples (actual JSON)
5. Summary of Each Library's Expected Behavior
6. Open Questions (if any)

### Deliverable 3: Debug Logging Code
Implement all logging described in Part 3 in these files:
- `src/components/chat/JobMatcherRuntimeProvider.tsx`
- `src/lib/convexAgentBridge.ts`
- `src/components/chat/tools/index.tsx`
- `src/components/tool-ui/plan/plan.tsx`

---

## CRITICAL CONSTRAINTS

1. **DO NOT GUESS**. Every claim must be backed by source code or observable behavior.
2. **DO NOT PROPOSE FIXES** until root cause is identified with certainty.
3. **READ ALL SOURCE CODE** - not just documentation.
4. **TRACE ACTUAL DATA VALUES** - not just types.
5. **DOCUMENT UNCERTAINTY** - if something is unclear, say so explicitly.
6. **NO SHORTCUTS** - this investigation must be exhaustive.

---

## SUCCESS CRITERIA

The investigation is complete when:
1. We can explain EXACTLY why duplicates occur (with evidence)
2. We can predict WHEN duplicates will occur
3. We understand the complete data flow from LLM to DOM
4. We have logging in place to verify our understanding empirically
5. The fix (when implemented) will work the first time because we understand the problem

