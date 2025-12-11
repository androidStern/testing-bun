"use node";

import { v } from "convex/values";
import { internalAction } from "./_generated/server";
import { createInngestHandler } from "./inngest/handler";

export const handle = internalAction({
  args: {
    method: v.string(),
    url: v.string(),
    headers: v.any(), // Record<string, string>
    body: v.string(),
  },
  returns: v.object({
    status: v.number(),
    headers: v.any(), // Record<string, string>
    body: v.string(),
  }),
  handler: async (ctx, args) => {
    // 1. Reconstruct Request object
    const request = new Request(args.url, {
      method: args.method,
      headers: new Headers(args.headers as Record<string, string>),
      body: args.method !== "GET" && args.method !== "HEAD" ? args.body : undefined,
    });

    // 2. Create Inngest handler that uses THIS action's ctx
    const handler = createInngestHandler(ctx);

    // 3. Run Inngest SDK (node:async_hooks works here!)
    const response = await handler(request);

    // 4. Serialize Response
    const responseHeaders: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      responseHeaders[key] = value;
    });
    return {
      status: response.status,
      headers: responseHeaders,
      body: await response.text(),
    };
  },
});

// Action to send approval events to Inngest
export const sendApprovalEvent = internalAction({
  args: {
    approvalId: v.string(),
    decision: v.union(v.literal("approved"), v.literal("denied")),
    approvedBy: v.optional(v.string()),
    denyReason: v.optional(v.string()),
  },
  handler: async (_ctx, args) => {
    const { inngest } = await import("./inngest");
    await inngest.send({
      name: "slack/approval.clicked",
      data: {
        approvalId: args.approvalId,
        decision: args.decision,
        // No slack field = workflow knows it came from in-app
        ...(args.approvedBy && { approvedBy: args.approvedBy }),
        ...(args.denyReason && { denyReason: args.denyReason }),
      },
    });
  },
});
