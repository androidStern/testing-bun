import { v } from 'convex/values';
import { zodOutputToConvex } from 'convex-helpers/server/zod4';

import { internal } from './_generated/api';
import { action, internalMutation, internalQuery } from './_generated/server';
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
