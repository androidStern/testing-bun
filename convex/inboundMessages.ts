import { v } from 'convex/values';

import { mutation, query } from './_generated/server';

export const get = query({
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

export const list = query({
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
        let sender = null;
        if (msg.senderId) {
          sender = await ctx.db.get(msg.senderId);
        }
        return { ...msg, sender };
      })
    );

    return messagesWithSenders;
  },
});

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

export const updateStatus = mutation({
  args: {
    messageId: v.id('inboundMessages'),
    status: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.messageId, { status: args.status });
  },
});
