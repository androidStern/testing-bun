import { v } from 'convex/values';

import { mutation, query } from './_generated/server';

export const getByPhone = query({
  args: { phone: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('senders')
      .withIndex('by_phone', (q) => q.eq('phone', args.phone))
      .first();
  },
});

export const list = query({
  args: { status: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const senders = args.status
      ? await ctx.db
          .query('senders')
          .withIndex('by_status', (idx) => idx.eq('status', args.status!))
          .collect()
      : await ctx.db.query('senders').collect();

    return senders.sort((a, b) => b.createdAt - a.createdAt);
  },
});

export const create = mutation({
  args: {
    phone: v.string(),
    status: v.optional(v.string()),
    name: v.optional(v.string()),
    company: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const id = await ctx.db.insert('senders', {
      phone: args.phone,
      status: args.status ?? 'pending',
      name: args.name,
      company: args.company,
      notes: args.notes,
      createdAt: now,
      updatedAt: now,
    });
    return id;
  },
});

export const update = mutation({
  args: {
    senderId: v.id('senders'),
    name: v.optional(v.string()),
    company: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { senderId, ...updates } = args;
    await ctx.db.patch(senderId, {
      ...updates,
      updatedAt: Date.now(),
    });
  },
});

export const updateStatus = mutation({
  args: {
    senderId: v.id('senders'),
    status: v.string(),
  },
  handler: async (ctx, args) => {
    const sender = await ctx.db.get(args.senderId);
    if (!sender) {
      throw new Error('Sender not found');
    }

    await ctx.db.patch(args.senderId, {
      status: args.status,
      updatedAt: Date.now(),
    });

    // If approving sender, update all their pending_review messages to approved
    if (args.status === 'approved') {
      const pendingMessages = await ctx.db
        .query('inboundMessages')
        .withIndex('by_phone', (q) => q.eq('phone', sender.phone))
        .collect();

      for (const msg of pendingMessages) {
        if (msg.status === 'pending_review') {
          await ctx.db.patch(msg._id, { status: 'approved' });
        }
      }
    }
  },
});
