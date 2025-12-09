import { v } from 'convex/values';

import { mutation, query } from './_generated/server';
import { adminMutation, adminQuery } from './functions';

// Public query (used by HTTP webhook)
export const getByPhone = query({
  args: { phone: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('senders')
      .withIndex('by_phone', (q) => q.eq('phone', args.phone))
      .first();
  },
});

// Public mutation (used by HTTP webhook)
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

// Admin-only: list senders with message counts and first message preview
export const list = adminQuery({
  args: { status: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const senders = args.status
      ? await ctx.db
          .query('senders')
          .withIndex('by_status', (idx) => idx.eq('status', args.status!))
          .collect()
      : await ctx.db.query('senders').collect();

    // Sort by createdAt desc
    senders.sort((a, b) => b.createdAt - a.createdAt);

    // Get message counts and first message preview for each sender
    const sendersWithData = await Promise.all(
      senders.map(async (sender) => {
        const messages = await ctx.db
          .query('inboundMessages')
          .withIndex('by_senderId', (q) => q.eq('senderId', sender._id))
          .collect();

        const firstMessage =
          messages.length > 0
            ? messages.reduce((oldest, msg) =>
                msg.createdAt < oldest.createdAt ? msg : oldest,
              )
            : null;

        return {
          ...sender,
          messageCount: messages.length,
          firstMessagePreview: firstMessage?.body?.slice(0, 100) ?? null,
        };
      }),
    );

    return sendersWithData;
  },
});

// Admin-only: update sender info
export const update = adminMutation({
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

// Admin-only: update sender status with cascade to messages
export const updateStatus = adminMutation({
  args: {
    senderId: v.id('senders'),
    status: v.union(
      v.literal('pending'),
      v.literal('approved'),
      v.literal('blocked'),
    ),
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

    // Cascade status to pending_review messages from this sender
    if (args.status === 'approved' || args.status === 'blocked') {
      const pendingMessages = await ctx.db
        .query('inboundMessages')
        .withIndex('by_senderId', (q) => q.eq('senderId', args.senderId))
        .collect();

      const newMessageStatus =
        args.status === 'approved' ? 'approved' : 'rejected';

      for (const msg of pendingMessages) {
        if (msg.status === 'pending_review') {
          await ctx.db.patch(msg._id, { status: newMessageStatus });
        }
      }
    }
  },
});
