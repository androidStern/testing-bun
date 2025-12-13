import { v } from 'convex/values';

import { mutation } from './_generated/server';
import { adminMutation, adminQuery } from './functions';

// Admin-only: get single message with sender info
export const get = adminQuery({
  args: { messageId: v.id('inboundMessages') },
  handler: async (ctx, args) => {
    const message = await ctx.db.get(args.messageId);
    if (!message) {
      return null;
    }

    let sender = null;
    if (message.senderId) {
      sender = await ctx.db.get(message.senderId);
    }

    return { ...message, sender };
  },
});

// Admin-only: list messages with sender info
export const list = adminQuery({
  args: { status: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const messages = args.status
      ? await ctx.db
          .query('inboundMessages')
          .withIndex('by_status', (idx) => idx.eq('status', args.status!))
          .collect()
      : await ctx.db.query('inboundMessages').collect();

    // Sort by createdAt desc
    messages.sort((a, b) => b.createdAt - a.createdAt);

    // Join sender info
    const messagesWithSenders = await Promise.all(
      messages.map(async (msg) => {
        const sender = msg.senderId ? await ctx.db.get(msg.senderId) : null;
        return {
          ...msg,
          sender: sender
            ? {
                name: sender.name,
                company: sender.company,
                status: sender.status,
              }
            : null,
        };
      }),
    );

    return messagesWithSenders;
  },
});

// Public mutation (used by HTTP webhook)
export const create = mutation({
  args: {
    phone: v.string(),
    body: v.string(),
    twilioMessageSid: v.string(),
    senderId: v.optional(v.id('senders')),
    status: v.string(),
  },
  handler: async (ctx, args) => {
    const id = await ctx.db.insert('inboundMessages', {
      phone: args.phone,
      body: args.body,
      twilioMessageSid: args.twilioMessageSid,
      senderId: args.senderId,
      status: args.status,
      createdAt: Date.now(),
    });
    return id;
  },
});

// Admin-only: update message status
export const updateStatus = adminMutation({
  args: {
    messageId: v.id('inboundMessages'),
    status: v.union(
      v.literal('pending_review'),
      v.literal('approved'),
      v.literal('rejected'),
      v.literal('processed'),
    ),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.messageId, { status: args.status });
  },
});

// Admin-only: delete message
export const deleteMessage = adminMutation({
  args: { messageId: v.id('inboundMessages') },
  handler: async (ctx, args) => {
    const message = await ctx.db.get(args.messageId);
    if (!message) throw new Error('Message not found');

    await ctx.db.delete(args.messageId);
  },
});

