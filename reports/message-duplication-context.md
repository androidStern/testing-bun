# Message Duplication Bug - Technical Context

## 1. Key Type Definitions

### Convex Agent: MessageDoc (Database Schema)
**File**: `node_modules/@convex-dev/agent/src/validators.ts` lines 477-513

```typescript
export const vMessageDoc = v.object({
  _id: v.string(),
  _creationTime: v.number(),
  userId: v.optional(v.string()),
  threadId: v.string(),
  order: v.number(),              // Message turn number (user message increments this)
  stepOrder: v.number(),          // Step within turn (tool calls/results increment this)
  embeddingId: v.optional(v.string()),
  fileIds: v.optional(v.array(v.string())),
  error: v.optional(v.string()),
  status: vMessageStatus,         // 'pending' | 'success' | 'failed'

  agentName: v.optional(v.string()),
  model: v.optional(v.string()),
  provider: v.optional(v.string()),
  providerOptions: v.optional(vProviderOptions),

  message: v.optional(vMessage),  // {role, content: Part[]}
  tool: v.boolean(),              // true if tool-call OR tool-result
  text: v.optional(v.string()),

  usage: v.optional(vUsage),
  providerMetadata: v.optional(vProviderMetadata),
  sources: v.optional(v.array(vSource)),
  warnings: v.optional(v.array(vLanguageModelCallWarning)),
  finishReason: v.optional(vFinishReason),
  reasoning: v.optional(v.string()),
  reasoningDetails: v.optional(vReasoningDetails),
});
```

### Convex Agent: UIMessage (Frontend)
**File**: `node_modules/@convex-dev/agent/src/UIMessages.ts` lines 35-47

```typescript
export type UIMessage<METADATA = unknown, DATA_PARTS, TOOLS> = 
  AIUIMessage<METADATA, DATA_PARTS, TOOLS> & {
    key: string;              // `${threadId}-${order}-${stepOrder}`
    order: number;            // From first message in group
    stepOrder: number;        // From first message in group  
    status: UIStatus;         // 'streaming' | 'pending' | 'success' | 'failed'
    agentName?: string;
    text: string;             // Combined text from all parts
    _creationTime: number;
  };
```

### Convex Agent: StreamMessage
**File**: `node_modules/@convex-dev/agent/src/validators.ts` lines 448-467

```typescript
export const vStreamMessage = v.object({
  streamId: v.string(),
  status: v.union(
    v.literal("streaming"),
    v.literal("finished"),
    v.literal("aborted"),
  ),
  format: v.optional(
    v.union(v.literal("UIMessageChunk"), v.literal("TextStreamPart")),
  ),
  order: v.number(),
  stepOrder: v.number(),
  userId: v.optional(v.string()),
  agentName: v.optional(v.string()),
  model: v.optional(v.string()),
  provider: v.optional(v.string()),
  providerOptions: v.optional(vProviderOptions),
});
```

### assistant-ui: ThreadMessageLike
**From**: `@assistant-ui/react`

```typescript
type ThreadMessageLike = {
  id?: string;
  role: 'assistant' | 'user' | 'system';
  content: string | readonly ContentPart[];
  createdAt?: Date;
  status?: MessageStatus;
  metadata?: {
    custom?: Record<string, unknown>;
  };
}

type MessageStatus = 
  | { type: 'running' }
  | { type: 'complete'; reason: 'stop' | 'length' | 'content-filter' | 'tool-calls' | 'unknown' }
  | { type: 'incomplete'; reason: 'cancelled' | 'length' | 'content-filter' | 'error' | 'other'; error?: string }
```

---

## 2. Critical Code Snippets

### 2.1 Database Message Storage
**File**: `node_modules/@convex-dev/agent/src/component/messages.ts` lines 280-294

```typescript
// In addMessagesHandler - how order/stepOrder are assigned:
if (message.message.role === "user") {
  if (promptMessage && promptMessage.order === order) {
    const maxMessage = await getMaxMessage(ctx, threadId);
    order = (maxMessage?.order ?? order) + 1;
  } else {
    order++;
  }
  stepOrder = 0;  // User messages reset stepOrder to 0
} else {
  if (order < 0) {
    order = 0;
  }
  stepOrder++;    // Assistant/tool messages increment stepOrder
}
```

### 2.2 Message Grouping Logic
**File**: `node_modules/@convex-dev/agent/src/UIMessages.ts` lines 199-264

```typescript
function groupAssistantMessages<METADATA>(messages) {
  const groups: Group<METADATA>[] = [];
  let currentAssistantGroup: MessageDoc[] = [];
  let currentOrder: number | undefined;

  for (const message of messages) {
    const coreMessage = message.message && toModelMessage(message.message);
    if (!coreMessage) continue;

    if (coreMessage.role === "user" || coreMessage.role === "system") {
      // Flush current assistant group
      if (currentAssistantGroup.length > 0) {
        groups.push({ role: "assistant", messages: currentAssistantGroup });
        currentAssistantGroup = [];
        currentOrder = undefined;
      }
      groups.push({ role: coreMessage.role, message });
    } else {
      // Assistant or tool message - group by order
      if (currentOrder !== undefined && message.order !== currentOrder) {
        if (currentAssistantGroup.length > 0) {
          groups.push({ role: "assistant", messages: currentAssistantGroup });
          currentAssistantGroup = [];
        }
      }
      currentOrder = message.order;
      currentAssistantGroup.push(message);

      // End group if non-tool assistant message (pure text response)
      if (coreMessage.role === "assistant" && !message.tool) {
        groups.push({ role: "assistant", messages: currentAssistantGroup });
        currentAssistantGroup = [];
        currentOrder = undefined;
      }
    }
  }
  // Flush remaining
  if (currentAssistantGroup.length > 0) {
    groups.push({ role: "assistant", messages: currentAssistantGroup });
  }
  return groups;
}
```

### 2.3 UIMessage Creation (First stepOrder Used)
**File**: `node_modules/@convex-dev/agent/src/UIMessages.ts` lines 355-380

```typescript
function createAssistantUIMessage<METADATA, DATA_PARTS, TOOLS>(
  groupUnordered: (MessageDoc & ExtraFields<METADATA>)[],
): UIMessage<METADATA, DATA_PARTS, TOOLS> {
  const group = sorted(groupUnordered);
  const firstMessage = group[0];

  // CRITICAL: Uses FIRST message's order/stepOrder for the combined UIMessage
  const common = {
    id: firstMessage._id,
    _creationTime: firstMessage._creationTime,
    order: firstMessage.order,
    stepOrder: firstMessage.stepOrder,  // ← FROM FIRST MESSAGE
    key: `${firstMessage.threadId}-${firstMessage.order}-${firstMessage.stepOrder}`,
    agentName: firstMessage.agentName,
  };

  // Status from LAST message
  const lastMessage = group[group.length - 1];
  const status = lastMessage.streaming ? "streaming" : lastMessage.status;

  // Collect ALL parts from ALL messages in group
  const allParts = [];
  for (const message of group) {
    // ... extract parts from each message
  }

  return { ...common, role: "assistant", text: joinText(allParts), status, parts: allParts };
}
```

### 2.4 Tool Call/Result Part Handling
**File**: `node_modules/@convex-dev/agent/src/UIMessages.ts` lines 440-506

```typescript
// Tool-call becomes a typed part: type: `tool-${toolName}`
case "tool-call": {
  allParts.push({ type: "step-start" });
  const toolPart: ToolUIPart<TOOLS> = {
    type: `tool-${contentPart.toolName as keyof TOOLS & string}`,
    toolCallId: contentPart.toolCallId,
    input: contentPart.input,
    providerExecuted: contentPart.providerExecuted,
    ...(message.streaming
      ? { state: "input-streaming" }
      : { state: "input-available", callProviderMetadata: message.providerMetadata }),
  };
  allParts.push(toolPart);
  break;
}

// Tool-result UPDATES the matching tool-call part
case "tool-result": {
  const output = /* extract output */;
  const call = allParts.find(
    (part) =>
      part.type === `tool-${contentPart.toolName}` &&
      "toolCallId" in part &&
      part.toolCallId === contentPart.toolCallId,
  ) as ToolUIPart | undefined;
  
  if (call) {
    // Update existing tool-call with result
    if (message.error) {
      call.state = "output-error";
      call.errorText = message.error;
      call.output = output;
    } else {
      call.state = "output-available";
      call.output = output;
    }
  } else {
    // ⚠️ WARNING: "Tool result without preceding tool call"
    console.warn("Tool result without preceding tool call.. adding anyways", contentPart);
    allParts.push({
      type: `tool-${contentPart.toolName}`,
      toolCallId: contentPart.toolCallId,
      state: message.error ? "output-error" : "output-available",
      input: undefined,
      output,
      errorText: message.error,
    });
  }
  break;
}
```

### 2.5 useUIMessages Hook Deduplication
**File**: `node_modules/@convex-dev/agent/src/react/useUIMessages.ts` lines 169-195

```typescript
export function dedupeMessages<M extends { order: number; stepOrder: number; status: UIStatus }>(
  messages: M[],
  streamMessages: M[],
): M[] {
  return sorted(messages.concat(streamMessages)).reduce((msgs, msg) => {
    const last = msgs.at(-1);
    if (!last) {
      return [msg];
    }
    // Different position = add new message
    if (last.order !== msg.order || last.stepOrder !== msg.stepOrder) {
      return [...msgs, msg];
    }
    // Same position - prefer non-pending status
    if (
      (last.status === "pending" || last.status === "streaming") &&
      msg.status !== "pending"
    ) {
      return [...msgs.slice(0, -1), msg];
    }
    // Skip duplicate
    return msgs;
  }, [] as M[]);
}
```

### 2.6 Our Canonicalization (The Bug)
**File**: `src/components/chat/JobMatcherRuntimeProvider.tsx` lines 75-89

```typescript
const convertedMessages = useMemo(() => {
  if (!messages?.length) return []

  // ❌ BUG: This logic is unnecessary and potentially harmful
  // toUIMessages already grouped by order. All messages with same order
  // are combined into ONE UIMessage with stepOrder from the FIRST message.
  const latestByOrder = new Map<number, (typeof messages)[number]>()
  for (const msg of messages) {
    const existing = latestByOrder.get(msg.order)
    if (!existing || msg.stepOrder > existing.stepOrder) {
      latestByOrder.set(msg.order, msg)  // Keeps HIGHEST stepOrder
    }
  }

  const canonicalMessages = Array.from(latestByOrder.values()).sort((a, b) => a.order - b.order)
  // ...
}, [messages, toolResults])
```

### 2.7 Bridge Message Conversion
**File**: `src/lib/convexAgentBridge.ts` lines 29-59

```typescript
export function convertConvexMessage(msg: ConvexUIMessage): ThreadMessageLike {
  const content = convertParts(msg.parts)

  // ID assignment: uses order as stable ID
  const baseMessage = {
    content: content as ThreadMessageLike['content'],
    createdAt: new Date(msg._creationTime),
    id: String(msg.order),  // ← Stable ID based on order
    metadata: {
      custom: {
        agentName: msg.agentName,
        key: msg.key,
        order: msg.order,
        stepOrder: msg.stepOrder,
      },
    },
    role: msg.role as 'assistant' | 'user' | 'system',
  }

  if (msg.role === 'assistant') {
    return { ...baseMessage, status: mapStatus(msg.status, msg) }
  }
  return baseMessage
}
```

### 2.8 Parts Conversion (Skips tool-result)
**File**: `src/lib/convexAgentBridge.ts` lines 137-210

```typescript
const INTERNAL_PART_TYPES = new Set([
  'step-start',
  'step-finish',
  'source',
  'file',
  'tool-result',  // ← Skipped because result comes via output field on tool-{name} parts
])

function convertParts(parts: ConvexUIMessage['parts']): readonly ContentPart[] {
  const result: ContentPart[] = []

  for (const part of parts) {
    if (INTERNAL_PART_TYPES.has(part.type)) {
      continue  // Skip internal parts
    }

    if (part.type === 'text') {
      result.push({ text: part.text, type: 'text' })
      continue
    }

    // Tool call parts: type is 'tool-{toolName}'
    if (part.type.startsWith('tool-') || 'toolName' in part) {
      const toolName = toolPart.toolName ?? part.type.replace('tool-', '')
      result.push({
        args: (toolPart.input ?? {}) as Readonly<Record<string, unknown>>,
        result: toolPart.output,  // Result is here, not in separate tool-result part
        toolCallId: toolPart.toolCallId ?? `${toolName}-${Date.now()}`,  // ⚠️ Fallback ID
        toolName,
        type: 'tool-call',
      })
      continue
    }
    // ...
  }
  return result
}
```

---

## 3. Database Schema

### Messages Table Index
**File**: `node_modules/@convex-dev/agent/src/component/schema.ts` lines 70-77

```typescript
.index("threadId_status_tool_order_stepOrder", [
  "threadId",
  "status",
  "tool",      // Boolean: true for tool-call or tool-result messages
  "order",     // Message turn number
  "stepOrder", // Step within turn
])
```

### Streaming Messages Table
**File**: `node_modules/@convex-dev/agent/src/component/schema.ts` lines 87-130

```typescript
streamingMessages: defineTable({
  userId: v.optional(v.string()),
  agentName: v.optional(v.string()),
  model: v.optional(v.string()),
  provider: v.optional(v.string()),
  providerOptions: v.optional(vProviderOptions),
  format: v.optional(v.union(v.literal("UIMessageChunk"), v.literal("TextStreamPart"))),
  threadId: v.id("threads"),
  order: v.number(),
  stepOrder: v.number(),  // First message's stepOrder in the stream
  state: v.union(
    v.object({ kind: v.literal("streaming"), lastHeartbeat: v.number(), timeoutFnId: v.optional(v.id("_scheduled_functions")) }),
    v.object({ kind: v.literal("finished"), endedAt: v.number(), cleanupFnId: v.optional(v.id("_scheduled_functions")) }),
    v.object({ kind: v.literal("aborted"), reason: v.string() }),
  ),
})
  .index("threadId_state_order_stepOrder", ["threadId", "state.kind", "order", "stepOrder"])
```

---

## 4. Message Format Examples

### Raw MessageDoc (from database)
```json
{
  "_id": "msgDoc_abc123",
  "_creationTime": 1704067200000,
  "threadId": "thread_xyz",
  "order": 0,
  "stepOrder": 1,
  "status": "success",
  "tool": true,
  "agentName": "Job Matcher",
  "message": {
    "role": "assistant",
    "content": [
      {
        "type": "tool-call",
        "toolCallId": "call_abc123",
        "toolName": "showPlan",
        "args": {
          "id": "job-search-plan",
          "title": "Finding jobs for you",
          "todos": [
            {"id": "load-profile", "label": "Loading your profile", "status": "in_progress"}
          ]
        }
      }
    ]
  }
}
```

### UIMessage (after toUIMessages)
```json
{
  "id": "msgDoc_abc123",
  "key": "thread_xyz-0-1",
  "order": 0,
  "stepOrder": 1,
  "status": "success",
  "role": "assistant",
  "agentName": "Job Matcher",
  "text": "",
  "_creationTime": 1704067200000,
  "parts": [
    {"type": "step-start"},
    {
      "type": "tool-showPlan",
      "toolCallId": "call_abc123",
      "input": {"id": "job-search-plan", "title": "Finding jobs for you", "todos": [...]},
      "state": "output-available",
      "output": {"id": "job-search-plan", "title": "Finding jobs for you", "todos": [...]}
    }
  ]
}
```

### ThreadMessageLike (after bridge conversion)
```json
{
  "id": "0",
  "role": "assistant",
  "createdAt": "2024-01-01T00:00:00.000Z",
  "status": {"type": "complete", "reason": "stop"},
  "metadata": {
    "custom": {
      "agentName": "Job Matcher",
      "key": "thread_xyz-0-1",
      "order": 0,
      "stepOrder": 1
    }
  },
  "content": [
    {
      "type": "tool-call",
      "toolName": "showPlan",
      "toolCallId": "call_abc123",
      "args": {"id": "job-search-plan", "title": "Finding jobs for you", "todos": [...]},
      "result": {"id": "job-search-plan", "title": "Finding jobs for you", "todos": [...]}
    }
  ]
}
```

---

## 5. Summary of Expected Behavior

### Convex Agent (toUIMessages)
- Groups ALL messages with same `order` into ONE UIMessage
- Uses FIRST message's `stepOrder` and `_id` for the UIMessage
- Collects all parts from all messages in group
- Tool-results UPDATE the matching tool-call part (not separate parts)

### useUIMessages Hook
- Merges paginated results with streaming messages
- Dedupes by `order` + `stepOrder` combination
- Prefers non-pending status over pending
- Calls `combineUIMessages` to re-combine pagination-split messages

### Our Bridge (convexAgentBridge)
- Converts UIMessage to ThreadMessageLike
- Uses `order` as stable message ID
- Converts `tool-{name}` parts to `tool-call` type
- Skips `tool-result` parts (data is in `output` field)

### assistant-ui Rendering
- Uses message `id` for React keys and identity
- Matches `toolName` with registered `makeAssistantToolUI` components
- Renders tool UIs based on `type: 'tool-call'` parts

---

## 6. Likely Bug Locations

| Location | Issue | Confidence |
|----------|-------|------------|
| `JobMatcherRuntimeProvider.tsx` lines 79-86 | Unnecessary canonicalization that may discard valid data | HIGH |
| Stream→Persisted transition | Race condition where both coexist briefly | MEDIUM |
| `convexAgentBridge.ts` line 187 | Fallback toolCallId with `Date.now()` breaks identity | LOW |
| Pagination splitting | Large turns split across pages may not recombine properly | LOW |
