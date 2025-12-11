Job Pipeline: Convex Workflow Implementation

 Why Convex Workflow (Not Inngest)

 Problem: Inngest SDK uses node:async_hooks which Convex HTTP actions don't support.
 Convex HTTP actions run in edge-like runtime without Node.js APIs.

 Solution: Use @convex-dev/workflow - native Convex durable workflows with similar API:
 - ctx.runMutation() / ctx.runAction() → like Inngest's step.run()
 - ctx.awaitEvent() → like Inngest's step.waitForEvent()
 - Native access to internal.* functions
 - No runtime compatibility issues

 ---
 Complete Architecture

 ┌──────────────────────────────────────────────────────────────────────────────┐
 │  EXTERNAL TRIGGERS                                                            │
 │                                                                               │
 │  Twilio ─────────────────┐                                                   │
 │  (SMS webhook)           │                                                   │
 │                          ▼                                                   │
 │  ┌───────────────────────────────────────────────────────────────────────┐   │
 │  │  CONVEX HTTP ACTIONS                                                   │   │
 │  │                                                                        │   │
 │  │  POST /webhooks/twilio-sms                                            │   │
 │  │    1. Parse SMS body                                                  │   │
 │  │    2. Create/lookup sender                                            │   │
 │  │    3. Create jobSubmission record                                     │   │
 │  │    4. workflow.start(processJobWorkflow, {submissionId}) ─────────┐   │   │
 │  │                                                                    │   │   │
 │  │  POST /webhooks/slack-interaction                                  │   │   │
 │  │    1. Verify Slack signature (HMAC-SHA256)                        │   │   │
 │  │    2. Parse action payload (approve/deny button click)            │   │   │
 │  │    3. Extract submissionId from callback_id                       │   │   │
 │  │    4. workflow.sendEvent(workflowId, {                            │   │   │
 │  │         name: "job/decision",                                     │   │   │
 │  │         decision: "approved" | "denied",                          │   │   │
 │  │         slack: { responseUrl, userName }                          │   │   │
 │  │       }) ─────────────────────────────────────────────────────┐   │   │   │
 │  │                                                                │   │   │   │
 │  └────────────────────────────────────────────────────────────────┼───┼───┘   │
 │                                                                   │   │       │
 │  ┌────────────────────────────────────────────────────────────────┼───┼───┐   │
 │  │  CONVEX MUTATIONS (called from admin UI)                       │   │   │   │
 │  │                                                                │   │   │   │
 │  │  jobs.approveFromUI(submissionId)                             │   │   │   │
 │  │    1. Look up workflowId from jobSubmissions table            │   │   │   │
 │  │    2. workflow.sendEvent(workflowId, {                        │   │   │   │
 │  │         name: "job/decision",                                 │   │   │   │
 │  │         decision: "approved",                                 │   │   │   │
 │  │         approvedBy: currentUser                               │   │   │   │
 │  │       }) ─────────────────────────────────────────────────┐   │   │   │   │
 │  │                                                            │   │   │   │   │
 │  │  jobs.denyFromUI(submissionId, reason)                    │   │   │   │   │
 │  │    1. Look up workflowId                                  │   │   │   │   │
 │  │    2. workflow.sendEvent(..., decision: "denied") ────┐   │   │   │   │   │
 │  │                                                        │   │   │   │   │   │
 │  └────────────────────────────────────────────────────────┼───┼───┼───┼───┘   │
 │                                                           │   │   │   │       │
 └───────────────────────────────────────────────────────────┼───┼───┼───┼───────┘
                                                             │   │   │   │
                                                             ▼   ▼   ▼   ▼
 ┌───────────────────────────────────────────────────────────────────────────────┐
 │  CONVEX WORKFLOW ENGINE (@convex-dev/workflow)                                │
 │                                                                               │
 │  processJobWorkflow:                                                          │
 │  ┌─────────────────────────────────────────────────────────────────────────┐ │
 │  │                                                                          │ │
 │  │  1. ctx.runAction(internal.jobSteps.parseWithAI, {submissionId})        │ │
 │  │       └─► Fetches raw content, calls OpenAI, saves parsed job           │ │
 │  │                                                                          │ │
 │  │  2. ctx.runAction(internal.jobSteps.postSlackApproval, {submissionId})  │ │
 │  │       └─► Posts message with Approve/Deny buttons to Slack channel      │ │
 │  │       └─► Returns { blocks, messageTs } (memoized for later)            │ │
 │  │                                                                          │ │
 │  │  3. const event = await ctx.awaitEvent({name: "job/decision"})          │ │
 │  │       └─► WORKFLOW PAUSES HERE                                          │ │
 │  │       └─► Waits for sendEvent() from Slack webhook OR admin UI          │ │
 │  │       └─► First one wins - workflow resumes with that event             │ │
 │  │                                                                          │ │
 │  │  4. if (event.decision === "approved") {                                │ │
 │  │       ctx.runAction(internal.jobSteps.updateSlackMessage, {...})        │ │
 │  │         └─► Updates Slack message to show "Approved by X"               │ │
 │  │       ctx.runAction(internal.jobSteps.postToCircle, {submissionId})     │ │
 │  │         └─► Posts job to Circle.so community                            │ │
 │  │       ctx.runMutation(internal.jobSteps.markApproved, {submissionId})   │ │
 │  │     } else {                                                            │ │
 │  │       ctx.runMutation(internal.jobSteps.markDenied, {submissionId})     │ │
 │  │     }                                                                   │ │
 │  │                                                                          │ │
 │  └─────────────────────────────────────────────────────────────────────────┘ │
 │                                                                               │
 │  TIMEOUT HANDLING:                                                           │
 │  - ctx.awaitEvent() doesn't have native timeout                              │
 │  - Option A: Use onComplete handler with scheduled cleanup                   │
 │  - Option B: Parallel ctx.sleep(7 days) that cancels workflow on wake        │
 │                                                                               │
 └───────────────────────────────────────────────────────────────────────────────┘

 ---
 Complete Event Flow: SMS → Approval → Circle

 Flow 1: SMS Arrives

 1. Twilio sends POST to https://efficient-dove-571.convex.site/webhooks/twilio-sms
    Body: From=+15551234567, Body="Hiring Senior Dev at Acme...", MessageSid=SM123

 2. HTTP Action handler:
    - Parse form data
    - Upsert sender (by phone)
    - Insert jobSubmissions record (status: "pending_parse")
    - const workflowId = await workflow.start(ctx, internal.workflows.processJob, {
        submissionId
      })
    - Update jobSubmissions with workflowId
    - Return TwiML response

 3. Workflow starts automatically (async)

 Flow 2: Workflow Runs Parse + Slack Steps

 4. Step 1 runs: parseWithAI action
    - Fetch submission.rawContent
    - Call OpenAI to parse into structured job
    - Update jobSubmissions.parsedJob
    - Update status → "pending_approval"

 5. Step 2 runs: postSlackApproval action
    - Build Slack blocks with job details
    - Add Approve/Deny buttons with callback_id = submissionId
    - POST to Slack API
    - Return { blocks, messageTs }

 6. Step 3: ctx.awaitEvent({name: "job/decision"})
    - WORKFLOW PAUSES
    - State persisted in Convex workflow tables
    - Waiting for external event...

 Flow 3a: Slack Approval

 7. User clicks "Approve" button in Slack

 8. Slack sends POST to https://efficient-dove-571.convex.site/webhooks/slack-interaction
    Body: payload={"type":"block_actions","actions":[{"action_id":"approve",...}],...}
    Headers: X-Slack-Signature, X-Slack-Request-Timestamp

 9. HTTP Action handler:
    - Verify signature using SLACK_SIGNING_SECRET
    - Parse payload JSON
    - Extract: submissionId (from callback_id), userName, responseUrl
    - Look up workflowId from jobSubmissions table
    - await workflow.sendEvent(ctx, workflowId, {
        name: "job/decision",
        decision: "approved",
        slack: { responseUrl, userName }
      })
    - Return 200 OK immediately (Slack expects fast response)

 10. Workflow RESUMES at awaitEvent with the event data

 Flow 3b: In-App Approval (Alternative)

 7b. Admin clicks "Approve" button in TanStack app

 8b. Frontend calls: api.jobs.approveFromUI({ submissionId })

 9b. Mutation handler:
     - Get workflowId from jobSubmissions
     - await workflow.sendEvent(ctx, workflowId, {
         name: "job/decision",
         decision: "approved",
         approvedBy: ctx.auth.getUserIdentity().name
       })

 10b. Workflow RESUMES (same as above)

 Flow 4: Finalize

 11. Workflow continues after awaitEvent returns

 12. Check event.decision:
     - If "approved":
       a. If event.slack exists: Update Slack message via responseUrl
       b. Call Circle API to post job
       c. Update jobSubmissions: status="approved", approvedBy, circlePostUrl
     - If "denied":
       a. If event.slack exists: Update Slack message to show denied
       b. Update jobSubmissions: status="denied", denyReason

 13. Workflow completes
     - onComplete handler runs (optional: cleanup, notifications)

 ---
 Files to Create/Modify

 New Files

 | File                           | Purpose                                                                            |
 |--------------------------------|------------------------------------------------------------------------------------|
 | convex/convex.config.ts        | Install @convex-dev/workflow component                                             |
 | convex/workflow.ts             | WorkflowManager instance                                                           |
 | convex/workflows/processJob.ts | The workflow definition                                                            |
 | convex/actions/jobSteps.ts     | Internal actions: parseWithAI, postSlackApproval, updateSlackMessage, postToCircle |
 | convex/mutations/jobSteps.ts   | Internal mutations: markApproved, markDenied                                       |

 Files to Modify

 | File                     | Changes                                                                     |
 |--------------------------|-----------------------------------------------------------------------------|
 | convex/http.ts           | Add /webhooks/slack-interaction route, modify SMS handler to start workflow |
 | convex/schema.ts         | Add workflowId field to jobSubmissions                                      |
 | convex/jobSubmissions.ts | Add approveFromUI, denyFromUI mutations                                     |

 Files to Remove

 | File                         | Reason                                     |
 |------------------------------|--------------------------------------------|
 | convex/inngest/client.ts     | Replaced by Convex Workflow                |
 | convex/inngest/processJob.ts | Replaced by convex/workflows/processJob.ts |
 | convex/inngest/index.ts      | No longer needed                           |

 ---
 Key Code Examples

 1. Workflow Definition

 // convex/workflows/processJob.ts
 import { workflow } from "../workflow";
 import { internal } from "../_generated/api";
 import { v } from "convex/values";

 export const processJob = workflow.define({
   args: { submissionId: v.id("jobSubmissions") },
   handler: async (ctx, args): Promise<void> => {
     // Step 1: Parse with AI
     const parsedJob = await ctx.runAction(
       internal.actions.jobSteps.parseWithAI,
       { submissionId: args.submissionId }
     );

     // Step 2: Post to Slack
     const slackResult = await ctx.runAction(
       internal.actions.jobSteps.postSlackApproval,
       { submissionId: args.submissionId, parsedJob }
     );

     // Step 3: Wait for approval (Slack or in-app)
     const event = await ctx.awaitEvent({ name: "job/decision" });

     // Step 4: Handle decision
     if (event.decision === "approved") {
       // Update Slack message if approved via Slack
       if (event.slack?.responseUrl) {
         await ctx.runAction(internal.actions.jobSteps.updateSlackMessage, {
           responseUrl: event.slack.responseUrl,
           decision: "approved",
           userName: event.slack.userName,
           originalBlocks: slackResult.blocks,
         });
       }

       // Post to Circle
       await ctx.runAction(internal.actions.jobSteps.postToCircle, {
         submissionId: args.submissionId,
       });

       // Mark approved in DB
       await ctx.runMutation(internal.mutations.jobSteps.markApproved, {
         submissionId: args.submissionId,
         approvedBy: event.slack?.userName ?? event.approvedBy,
       });
     } else {
       await ctx.runMutation(internal.mutations.jobSteps.markDenied, {
         submissionId: args.submissionId,
         reason: event.reason ?? "Denied",
       });
     }
   },
 });

 2. Slack Webhook Handler

 // convex/http.ts (new route)
 http.route({
   path: "/webhooks/slack-interaction",
   method: "POST",
   handler: httpAction(async (ctx, request) => {
     // 1. Verify Slack signature
     const body = await request.text();
     const timestamp = request.headers.get("x-slack-request-timestamp");
     const signature = request.headers.get("x-slack-signature");

     const isValid = verifySlackSignature({
       body,
       timestamp: Number(timestamp),
       signature: signature!,
       signingSecret: process.env.SLACK_SIGNING_SECRET!,
     });

     if (!isValid) {
       return new Response("Invalid signature", { status: 401 });
     }

     // 2. Parse payload
     const params = new URLSearchParams(body);
     const payload = JSON.parse(params.get("payload")!);

     const action = payload.actions[0];
     const submissionId = payload.callback_id; // We set this when posting
     const decision = action.action_id; // "approve" or "deny"
     const userName = payload.user.name;
     const responseUrl = payload.response_url;

     // 3. Look up workflow ID
     const submission = await ctx.runQuery(internal.jobSubmissions.get, {
       id: submissionId,
     });

     if (!submission?.workflowId) {
       return new Response("Workflow not found", { status: 404 });
     }

     // 4. Send event to resume workflow
     await workflow.sendEvent(ctx, submission.workflowId, {
       name: "job/decision",
       decision: decision === "approve" ? "approved" : "denied",
       slack: { responseUrl, userName },
     });

     // 5. Respond immediately (Slack expects <3s response)
     return new Response("OK", { status: 200 });
   }),
 });

 3. In-App Approval Mutation

 // convex/jobSubmissions.ts
 export const approveFromUI = mutation({
   args: { submissionId: v.id("jobSubmissions") },
   handler: async (ctx, args) => {
     const identity = await ctx.auth.getUserIdentity();
     if (!identity) throw new Error("Not authenticated");

     const submission = await ctx.db.get(args.submissionId);
     if (!submission) throw new Error("Submission not found");
     if (!submission.workflowId) throw new Error("No workflow for this submission");
     if (submission.status !== "pending_approval") {
       throw new Error("Already processed");
     }

     // Send event to resume workflow
     await workflow.sendEvent(ctx, submission.workflowId, {
       name: "job/decision",
       decision: "approved",
       approvedBy: identity.name ?? identity.email,
     });
   },
 });

 ---
 Timeout Handling

 ctx.awaitEvent() doesn't have a built-in timeout. Options:

 Option A: Scheduled Cleanup Job (Recommended)

 // When workflow starts, schedule a cleanup check
 await ctx.scheduler.runAfter(
   7 * 24 * 60 * 60 * 1000, // 7 days
   internal.jobs.checkTimeoutAndCancel,
   { submissionId }
 );

 // The cleanup job:
 export const checkTimeoutAndCancel = mutation({
   handler: async (ctx, { submissionId }) => {
     const submission = await ctx.db.get(submissionId);
     if (submission?.status === "pending_approval") {
       // Still waiting - cancel and mark as timed out
       await workflow.cancel(ctx, submission.workflowId);
       await ctx.db.patch(submissionId, {
         status: "denied",
         denyReason: "Timed out after 7 days",
       });
     }
     // If already approved/denied, do nothing
   },
 });

 Option B: Parallel Sleep (More Complex)

 // In workflow:
 const [event] = await Promise.race([
   ctx.awaitEvent({ name: "job/decision" }),
   ctx.sleep(7 * 24 * 60 * 60 * 1000).then(() => null),
 ]);

 if (!event) {
   // Timed out
   await ctx.runMutation(internal.jobSteps.markDenied, {
     submissionId: args.submissionId,
     reason: "Timed out after 7 days",
   });
   return;
 }

 ---
 Data Model Updates

 // convex/schema.ts - add to jobSubmissions:
 jobSubmissions: defineTable({
   // ... existing fields ...

   // NEW: Link to workflow for sending events
   workflowId: v.optional(v.string()),

 }).index("by_workflowId", ["workflowId"])

 ---
 Implementation Order

 1. Setup (5 min)
   - Create convex/convex.config.ts
   - Create convex/workflow.ts
   - Add workflowId to schema
   - Run bunx convex dev to verify component installs
 2. Workflow Steps (30 min)
   - Create convex/actions/jobSteps.ts with internal actions
   - Create convex/mutations/jobSteps.ts with internal mutations
   - Port logic from existing convex/lib/slack.ts, convex/lib/circle.ts
 3. Workflow Definition (15 min)
   - Create convex/workflows/processJob.ts
   - Wire up all steps
 4. HTTP Handlers (20 min)
   - Modify SMS handler to start workflow
   - Add Slack webhook handler
 5. Admin UI Integration (10 min)
   - Add approveFromUI / denyFromUI mutations
 6. Cleanup (5 min)
   - Remove convex/inngest/ directory
   - Remove Inngest routes from http.ts

 ---
 Testing Plan

 1. Local test: Use Convex dashboard to manually call workflow.start() with a test submissionId
 2. Slack test: Configure Slack app's Interactivity URL to point to Convex HTTP endpoint
 3. End-to-end: Send test SMS, verify Slack message appears, click approve, verify Circle post