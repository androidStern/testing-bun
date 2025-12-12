import { v } from 'convex/values';
import { zodOutputToConvex } from 'convex-helpers/server/zod4';

import { internal } from './_generated/api';
import { internalMutation, internalQuery, mutation } from './_generated/server';
import { ParsedJobSchema } from './lib/jobSchema';

// Auth helper - verifies internal API secret
function verifyInternalAuth(secret: string | undefined) {
  const expected = process.env.INTERNAL_API_SECRET;
  if (!expected || secret !== expected) {
    throw new Error('Unauthorized');
  }
}

export const get = internalQuery({
  args: { id: v.id('jobSubmissions') },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

export const create = internalMutation({
  args: {
    source: v.union(v.literal('sms'), v.literal('form')),
    senderId: v.id('senders'),
    rawContent: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert('jobSubmissions', {
      source: args.source,
      senderId: args.senderId,
      rawContent: args.rawContent,
      status: 'pending_parse',
      createdAt: Date.now(),
    });
  },
});

export const updateParsed = internalMutation({
  args: {
    id: v.id('jobSubmissions'),
    parsedJob: zodOutputToConvex(ParsedJobSchema),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      parsedJob: args.parsedJob,
      status: 'pending_approval',
    });
  },
});

export const approve = internalMutation({
  args: {
    id: v.id('jobSubmissions'),
    approvedBy: v.optional(v.string()),
    circlePostUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const submission = await ctx.db.get(args.id);
    if (!submission) throw new Error('Submission not found');

    // Idempotent: already approved, nothing to do
    if (submission.status === 'approved') {
      return;
    }

    if (!submission.parsedJob) throw new Error('Job not parsed yet');

    const now = Date.now();

    await ctx.db.patch(args.id, {
      status: 'approved',
      approvedAt: now,
      approvedBy: args.approvedBy,
      circlePostUrl: args.circlePostUrl,
    });

    // Approve the sender if pending (idempotent - patching same value is fine)
    const sender = await ctx.db.get(submission.senderId);
    if (sender && sender.status === 'pending') {
      await ctx.db.patch(submission.senderId, {
        status: 'approved',
        updatedAt: now,
      });
    }
  },
});

export const deny = internalMutation({
  args: {
    id: v.id('jobSubmissions'),
    denyReason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const submission = await ctx.db.get(args.id);
    if (!submission) throw new Error('Submission not found');

    // Idempotent: already denied, nothing to do
    if (submission.status === 'denied') {
      return;
    }

    await ctx.db.patch(args.id, {
      status: 'denied',
      denyReason: args.denyReason || 'Denied',
    });
  },
});

// Public mutations for in-app approval (called from admin UI)
// These schedule the Inngest event to resume the waiting workflow

export const approveFromUI = mutation({
  args: { submissionId: v.id('jobSubmissions') },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error('Not authenticated');

    const submission = await ctx.db.get(args.submissionId);
    if (!submission) throw new Error('Submission not found');
    if (submission.status !== 'pending_approval') {
      throw new Error(`Cannot approve: status is ${submission.status}`);
    }

    // Schedule Node.js action to send Inngest event
    await ctx.scheduler.runAfter(0, internal.inngestNode.sendApprovalEvent, {
      approvalId: args.submissionId,
      decision: 'approved',
      approvedBy: identity.name ?? identity.email ?? 'Admin',
    });
  },
});

export const denyFromUI = mutation({
  args: {
    submissionId: v.id('jobSubmissions'),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error('Not authenticated');

    const submission = await ctx.db.get(args.submissionId);
    if (!submission) throw new Error('Submission not found');
    if (submission.status !== 'pending_approval') {
      throw new Error(`Cannot deny: status is ${submission.status}`);
    }

    // Schedule Node.js action to send Inngest event
    await ctx.scheduler.runAfter(0, internal.inngestNode.sendApprovalEvent, {
      approvalId: args.submissionId,
      decision: 'denied',
      denyReason: args.reason ?? 'Denied via admin UI',
    });
  },
});
