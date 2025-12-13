import { v } from 'convex/values';
import { zodOutputToConvex } from 'convex-helpers/server/zod4';

import { internal } from './_generated/api';
import { internalMutation, internalQuery, query } from './_generated/server';
import { adminMutation, adminQuery } from './functions';
import { ParsedJobSchema } from './lib/jobSchema';

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

// Admin mutations for in-app approval (called from admin UI)
// These schedule the Inngest event to resume the waiting workflow

export const approveFromUI = adminMutation({
  args: { submissionId: v.id('jobSubmissions') },
  handler: async (ctx, args) => {
    const submission = await ctx.db.get(args.submissionId);
    if (!submission) throw new Error('Submission not found');
    if (submission.status !== 'pending_approval') {
      throw new Error(`Cannot approve: status is ${submission.status}`);
    }

    // Schedule Node.js action to send Inngest event
    await ctx.scheduler.runAfter(0, internal.inngestNode.sendApprovalEvent, {
      approvalId: args.submissionId,
      decision: 'approved',
      approvedBy: ctx.user.email,
    });
  },
});

export const denyFromUI = adminMutation({
  args: {
    submissionId: v.id('jobSubmissions'),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
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

// Public query for apply page - only returns approved (non-closed) jobs
export const getForApply = query({
  args: { id: v.id('jobSubmissions') },
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.id);
    if (!job) return null;
    // Only approved jobs can be applied to (not pending, denied, or closed)
    if (job.status !== 'approved') return null;
    if (!job.parsedJob) return null;

    return {
      _id: job._id,
      title: job.parsedJob.title,
      company: job.parsedJob.company.name,
      description: job.parsedJob.description,
      location: job.parsedJob.location
        ? [job.parsedJob.location.city, job.parsedJob.location.state]
            .filter(Boolean)
            .join(', ')
        : null,
      employmentType: job.parsedJob.employmentType,
      workArrangement: job.parsedJob.workArrangement,
    };
  },
});

// Close a job posting (internal mutation for SMS handling)
export const close = internalMutation({
  args: {
    id: v.id('jobSubmissions'),
    reason: v.union(v.literal('employer_request'), v.literal('auto_expired')),
  },
  handler: async (ctx, args) => {
    const submission = await ctx.db.get(args.id);
    if (!submission) throw new Error('Submission not found');

    // Idempotent: already closed, nothing to do
    if (submission.status === 'closed') {
      return { alreadyClosed: true };
    }

    // Only approved jobs can be closed
    if (submission.status !== 'approved') {
      throw new Error(`Cannot close: status is ${submission.status}`);
    }

    await ctx.db.patch(args.id, {
      status: 'closed',
      closedAt: Date.now(),
      closedReason: args.reason,
    });

    return { alreadyClosed: false };
  },
});

// Get the most recent open job for a sender (for STOP command handling)
export const getOpenBySender = internalQuery({
  args: { senderId: v.id('senders') },
  handler: async (ctx, args) => {
    // Find all approved jobs from this sender, sorted by creation date desc
    const jobs = await ctx.db
      .query('jobSubmissions')
      .withIndex('by_sender', (q) => q.eq('senderId', args.senderId))
      .filter((q) => q.eq(q.field('status'), 'approved'))
      .order('desc')
      .take(1);

    return jobs[0] || null;
  },
});

// Internal mutation to store Slack message reference after posting
export const updateSlackRef = internalMutation({
  args: {
    id: v.id('jobSubmissions'),
    slackChannel: v.string(),
    slackMessageTs: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      slackChannel: args.slackChannel,
      slackMessageTs: args.slackMessageTs,
    });
  },
});

// ============ Admin Operations ============

// Admin query - list all submissions with sender info
export const list = adminQuery({
  args: {
    status: v.optional(
      v.union(
        v.literal('pending_parse'),
        v.literal('pending_approval'),
        v.literal('approved'),
        v.literal('denied'),
        v.literal('closed')
      )
    ),
  },
  handler: async (ctx, args) => {
    const submissions = args.status
      ? await ctx.db
          .query('jobSubmissions')
          .withIndex('by_status', (q) => q.eq('status', args.status!))
          .collect()
      : await ctx.db.query('jobSubmissions').collect();

    // Sort by createdAt desc
    submissions.sort((a, b) => b.createdAt - a.createdAt);

    // Join sender info
    const submissionsWithSenders = await Promise.all(
      submissions.map(async (sub) => {
        const sender = await ctx.db.get(sub.senderId);
        return {
          ...sub,
          sender: sender
            ? {
                _id: sender._id,
                phone: sender.phone,
                email: sender.email,
                name: sender.name,
                company: sender.company,
                status: sender.status,
              }
            : null,
        };
      })
    );

    return submissionsWithSenders;
  },
});

// Admin mutation - update parsedJob fields (only for pending_approval jobs)
export const adminUpdateParsedJob = adminMutation({
  args: {
    id: v.id('jobSubmissions'),
    parsedJob: zodOutputToConvex(ParsedJobSchema),
  },
  handler: async (ctx, args) => {
    const submission = await ctx.db.get(args.id);
    if (!submission) throw new Error('Submission not found');

    // Only allow editing pending_approval jobs
    if (submission.status !== 'pending_approval') {
      throw new Error(
        `Cannot edit job: status is ${submission.status}. Only pending_approval jobs can be edited.`
      );
    }

    await ctx.db.patch(args.id, {
      parsedJob: args.parsedJob,
    });

    // Schedule action to update Slack message if we have a reference
    if (submission.slackChannel && submission.slackMessageTs) {
      await ctx.scheduler.runAfter(0, internal.inngestNode.updateSlackJobMessage, {
        submissionId: args.id,
        slackChannel: submission.slackChannel,
        slackMessageTs: submission.slackMessageTs,
        parsedJob: args.parsedJob,
      });
    }
  },
});
