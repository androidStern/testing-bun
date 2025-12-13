import { v } from 'convex/values';

import { internal } from './_generated/api';
import { internalMutation, internalQuery, mutation, query } from './_generated/server';
import { adminMutation, adminQuery } from './functions';
import { parseToken } from './lib/token';

import type { Id } from './_generated/dataModel';

// Internal query for workflow to fetch employer by ID
export const get = internalQuery({
  args: { id: v.id('employers') },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

// Internal query to get employer by sender ID
export const getBySenderId = internalQuery({
  args: { senderId: v.id('senders') },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('employers')
      .withIndex('by_sender', (q) => q.eq('senderId', args.senderId))
      .first();
  },
});

// Internal mutation to create employer (from employer signup form)
export const create = internalMutation({
  args: {
    senderId: v.id('senders'),
    name: v.string(),
    email: v.string(),
    phone: v.string(),
    company: v.string(),
    role: v.optional(v.string()),
    website: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const id = await ctx.db.insert('employers', {
      senderId: args.senderId,
      name: args.name,
      email: args.email,
      phone: args.phone,
      company: args.company,
      role: args.role,
      website: args.website,
      status: 'pending_review',
      createdAt: now,
    });
    return id;
  },
});

// Admin-only: list employers by status
export const list = adminQuery({
  args: {
    status: v.optional(
      v.union(
        v.literal('pending_review'),
        v.literal('approved'),
        v.literal('rejected')
      )
    ),
  },
  handler: async (ctx, args) => {
    const employers = args.status
      ? await ctx.db
          .query('employers')
          .withIndex('by_status', (q) => q.eq('status', args.status!))
          .collect()
      : await ctx.db.query('employers').collect();

    // Sort by createdAt desc
    employers.sort((a, b) => b.createdAt - a.createdAt);

    return employers;
  },
});

// Admin-only: approve employer (Checkpoint 3)
export const approve = adminMutation({
  args: { employerId: v.id('employers') },
  handler: async (ctx, args) => {
    const employer = await ctx.db.get(args.employerId);
    if (!employer) throw new Error('Employer not found');
    if (employer.status === 'approved') return; // Idempotent

    await ctx.db.patch(args.employerId, {
      status: 'approved',
      approvedAt: Date.now(),
      approvedBy: ctx.user.email,
    });

    // Send event to resume any waiting workflows
    await ctx.scheduler.runAfter(0, internal.inngestNode.sendEmployerApprovedEvent, {
      employerId: args.employerId,
      approvedBy: ctx.user.email,
    });
  },
});

// Admin-only: reject employer (Checkpoint 3)
export const reject = adminMutation({
  args: { employerId: v.id('employers') },
  handler: async (ctx, args) => {
    const employer = await ctx.db.get(args.employerId);
    if (!employer) throw new Error('Employer not found');
    if (employer.status === 'rejected') return; // Idempotent

    await ctx.db.patch(args.employerId, {
      status: 'rejected',
    });
  },
});

// Admin-only: delete employer
export const deleteEmployer = adminMutation({
  args: { employerId: v.id('employers') },
  handler: async (ctx, args) => {
    const employer = await ctx.db.get(args.employerId);
    if (!employer) throw new Error('Employer not found');

    await ctx.db.delete(args.employerId);
  },
});

// Internal mutation to link WorkOS user ID after account creation
export const linkWorkosUser = internalMutation({
  args: {
    employerId: v.id('employers'),
    workosUserId: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.employerId, {
      workosUserId: args.workosUserId,
    });
  },
});

// Public query: Get sender data for pre-filling signup form
// Returns null if token is invalid or expired
export const getSenderForSetup = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const tokenData = parseToken(args.token);
    if (!tokenData) return null;

    // Check expiry
    if (Date.now() > tokenData.exp) return null;

    // Fetch sender
    const senderId = tokenData.senderId as Id<'senders'>;
    const sender = await ctx.db.get(senderId);
    if (!sender) return null;

    // Check if employer already exists for this sender
    const existingEmployer = await ctx.db
      .query('employers')
      .withIndex('by_sender', (q) => q.eq('senderId', senderId))
      .first();

    return {
      senderId: sender._id,
      submissionId: tokenData.submissionId,
      prefill: {
        name: sender.name || '',
        email: sender.email || '',
        phone: sender.phone || '',
        company: sender.company || '',
      },
      alreadySetup: !!existingEmployer,
      employerStatus: existingEmployer?.status,
    };
  },
});

// Public mutation: Create employer from signup form
export const createFromSignup = mutation({
  args: {
    token: v.string(),
    name: v.string(),
    email: v.string(),
    phone: v.string(),
    company: v.string(),
    role: v.optional(v.string()),
    website: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const tokenData = parseToken(args.token);
    if (!tokenData) throw new Error('Invalid token');

    // Check expiry
    if (Date.now() > tokenData.exp) throw new Error('Token expired');

    // Verify sender exists
    const senderId = tokenData.senderId as Id<'senders'>;
    const sender = await ctx.db.get(senderId);
    if (!sender) throw new Error('Invalid token');

    // Check if employer already exists for this sender
    const existingEmployer = await ctx.db
      .query('employers')
      .withIndex('by_sender', (q) => q.eq('senderId', senderId))
      .first();

    if (existingEmployer) {
      // Return existing employer ID instead of creating duplicate
      return { employerId: existingEmployer._id, alreadyExisted: true };
    }

    // Create employer record
    const now = Date.now();
    const employerId = await ctx.db.insert('employers', {
      senderId: senderId,
      name: args.name,
      email: args.email,
      phone: args.phone,
      company: args.company,
      role: args.role,
      website: args.website,
      status: 'pending_review',
      createdAt: now,
    });

    // Post Slack notification for employer vetting (Checkpoint 3)
    await ctx.scheduler.runAfter(0, internal.inngestNode.postEmployerVettingToSlack, {
      employerId,
      name: args.name,
      email: args.email,
      phone: args.phone,
      company: args.company,
      role: args.role,
      website: args.website,
    });

    return { employerId, alreadyExisted: false };
  },
});
