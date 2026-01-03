# Bug Report: Duplicate Tool UI Rendering Due to Message Grouping

## Summary

Tool UI components (askQuestion, showPlan, searchJobs) render multiple times in the chat interface. The duplicates appear during the conversation flow but persist even after streaming completes. This is caused by Convex Agent's `toUIMessages` function grouping all messages with the same `order` value into a single UIMessage, which then contains multiple instances of the same tool types.

## Symptoms

1. **Duplicate askQuestion components**: The same question type appears twice (e.g., "What shifts work for you?" renders twice)
2. **Duplicate showPlan components**: Multiple plan cards showing the same plan with different progress states
3. **Duplicate searchJobs results**: Search result carousels appear multiple times with identical results
4. **Duplicates persist after refresh**: Unlike streaming artifacts, these duplicates remain after page reload

## Visual Evidence

See screenshot in the original bug report showing:
- "What shifts work for you?" question appearing twice
- "retail" search results appearing twice  
- Plan component appearing twice with different completion states

## Environment

- `@convex-dev/agent`: (check package.json for version)
- `@assistant-ui/react`: (check package.json for version)
- Frontend: TanStack Start + React
- Backend: Convex

## Reproduction Steps

1. Start a new job search conversation ("find me a job")
2. Wait for initial tools to execute (showPlan, getMyResume, getMyJobPreferences)
3. Agent asks first question via `askQuestion` tool (e.g., "What kind of work?")
4. User selects an option (e.g., "Retail")
5. Agent continues, calls `showPlan` again (update), then `askQuestion` again (e.g., "What shifts?")
6. **Observe**: Two askQuestion UIs visible, two showPlan UIs visible
7. User selects shift option
8. Agent searches and shows results
9. **Observe**: Search results appear twice

## Log Files

- Frontend logs: `/Users/winterfell/src/testing-bun/testing-bun/devtools-logs.log`
- Backend logs: `/Users/winterfell/src/testing-bun/testing-bun/convex-logs.log`

## Analysis

### Backend Message Storage (convex-logs.log)

The backend correctly stores individual messages with distinct `stepOrder` values, but ALL messages share `order=0`:

```
[DUPE-DEBUG] Found 16 messages in thread
msg[0] _id=ks7dydj7... order=0 stepOrder=15 parts=[text::]
msg[1] _id=ks75zgey... order=0 stepOrder=14 parts=[tool-result:askQuestion:functions.askQuestion:5]
msg[2] _id=ks70yth6... order=0 stepOrder=13 parts=[tool-call:askQuestion:functions.askQuestion:5]
msg[3] _id=ks79qpsq... order=0 stepOrder=12 parts=[tool-result:showPlan:functions.showPlan:4]
msg[4] _id=ks7ewehk... order=0 stepOrder=11 parts=[tool-call:showPlan:functions.showPlan:4]
msg[5] _id=ks705c5f... order=0 stepOrder=10 parts=[tool-result:askQuestion:functions.askQuestion:3]
msg[6] _id=ks767rpe... order=0 stepOrder=9  parts=[text::]
msg[7] _id=ks70xaan... order=0 stepOrder=8  parts=[tool-result:askQuestion:functions.askQuestion:3]
msg[8] _id=ks7cqedn... order=0 stepOrder=7  parts=[tool-call:askQuestion:functions.askQuestion:3]
msg[9] _id=ks73f0y0... order=0 stepOrder=6  parts=[tool-result:getMyJobPreferences:functions.getMyJobPreferences:2]
msg[10] _id=ks7b0bg9... order=0 stepOrder=5  parts=[tool-call:getMyJobPreferences:functions.getMyJobPreferences:2]
msg[11] _id=ks70fzn7... order=0 stepOrder=4  parts=[tool-result:getMyResume:functions.getMyResume:1]
msg[12] _id=ks73cxqg... order=0 stepOrder=3  parts=[tool-call:getMyResume:functions.getMyResume:1]
msg[13] _id=ks75984w... order=0 stepOrder=2  parts=[tool-result:showPlan:functions.showPlan:0]
msg[14] _id=ks725ftc... order=0 stepOrder=1  parts=[tool-call:showPlan:functions.showPlan:0]
msg[15] _id=ks74wsaz... order=0 stepOrder=0  parts=[]
```

Key observations:
- 16 individual messages in the database
- ALL have `order=0`
- Multiple tool-calls of the same type: `askQuestion:3` AND `askQuestion:5`, `showPlan:0` AND `showPlan:4`
- Each tool-call has its corresponding tool-result

### Frontend Raw Messages (devtools-logs.log)

The `useUIMessages` hook returns data where Convex Agent's `toUIMessages` has ALREADY grouped messages:

```json
{
  "count": 3,
  "messages": [
    {
      "id": "ks74wsaz0e77vzmf8mzrca1hjh7yhhsv",
      "order": 0,
      "stepOrder": 0,
      "role": "user",
      "parts": [{"type": "text"}]
    },
    {
      "id": "ks725ftc0kb0aka4mj8nzmf7097yg3ha",
      "order": 0,
      "stepOrder": 1,
      "role": "assistant",
      "parts": [
        {"type": "tool-showPlan", "toolCallId": "functions.showPlan:0"},
        {"type": "tool-getMyResume", "toolCallId": "functions.getMyResume:1"},
        {"type": "tool-getMyJobPreferences", "toolCallId": "functions.getMyJobPreferences:2"},
        {"type": "text"},
        {"type": "tool-askQuestion", "toolCallId": "functions.askQuestion:3"},
        {"type": "tool-showPlan", "toolCallId": "functions.showPlan:4"},
        {"type": "text"},
        {"type": "tool-askQuestion", "toolCallId": "functions.askQuestion:5"}
      ],
      "partsCount": 12
    },
    {
      "id": "stream:...",
      "order": 0,
      "stepOrder": 17,
      "role": "assistant",
      "status": "streaming"
    }
  ]
}
```

Key observations:
- 16 database messages become 2-3 UIMessages
- ONE assistant UIMessage contains ALL tool parts from ALL assistant/tool messages
- This single UIMessage has MULTIPLE `tool-askQuestion` parts (`:3` and `:5`)
- This single UIMessage has MULTIPLE `tool-showPlan` parts (`:0` and `:4`)

### Root Cause

Convex Agent's `toUIMessages` function (in `node_modules/@convex-dev/agent/src/UIMessages.ts`) groups messages by their `order` field. The grouping logic in `groupAssistantMessages()`:

1. Iterates through messages sorted by order/stepOrder
2. Groups consecutive assistant/tool messages with the same `order` into one group
3. Calls `createAssistantUIMessage()` which combines all parts into a single UIMessage

Since ALL messages in the thread have `order=0`:
- The initial streaming creates messages at order=0
- User tool responses saved with `promptMessageId` also get order=0
- Continuation streaming also creates messages at order=0
- Result: ALL messages grouped into ONE UIMessage

When this single UIMessage is rendered, assistant-ui iterates through its parts and renders each tool-call. Since there are multiple `askQuestion` tool-calls in the parts array, multiple question UIs render.

### Message Order Assignment Flow

1. `startSearch` action calls `streamText({ prompt: "find me a job" })`
   - Creates user message (order=0, stepOrder=0)
   - Streams assistant response (order=0, stepOrder=1+)
   
2. User responds to askQuestion, `submitToolResult` called
   - Finds toolCallMessage (order=0, stepOrder=7)
   - Saves tool-result with `promptMessageId` pointing to stepOrder=7 message
   - Tool-result gets order=0 (same as promptMessageId's order)
   - Calls `streamText({ promptMessageId })` to continue
   - New streaming messages get order=0

3. Cycle repeats - everything stays at order=0

### What We Tried (Did Not Fix)

1. Changed `id` field in message conversion from `msg.key` to `msg.id`
2. Added `promptMessageId` parameter to `submitToolResult` action
3. Query backend to find correct tool-call message by toolCallId
4. Various canonicalization/deduplication attempts in the frontend

These fixes addressed symptoms but not the root cause: the `order` value never increments.

## Questions for Investigation

1. When should `order` increment in Convex Agent's message model?
2. Is there a way to force a new `order` for continuation messages after human-in-the-loop tool responses?
3. Should the `toUIMessages` grouping logic handle multiple tool-calls of the same type within a group?
4. Is this a bug in Convex Agent or expected behavior that we need to work around?

## Relevant Code Locations

- `node_modules/@convex-dev/agent/src/UIMessages.ts` - `toUIMessages`, `groupAssistantMessages`, `createAssistantUIMessage`
- `node_modules/@convex-dev/agent/src/client/messages.ts` - `saveMessage`, `saveMessages`
- `convex/jobMatcher/actions.ts` - `submitToolResult`, `startSearch`
- `src/components/chat/JobMatcherRuntimeProvider.tsx` - Message subscription and conversion
- `src/lib/convexAgentBridge.ts` - UIMessage to ThreadMessageLike conversion
