import { v } from 'convex/values';

import { internalMutation } from './_generated/server';

export const createFromSms = internalMutation({
  args: {
    phone: v.string(),
    rawText: v.string(),
    twilioMessageSid: v.string(),
  },
  handler: async (ctx, args) => {
    // Check for duplicate MessageSid to prevent double-processing
    const existing = await ctx.db
      .query('inboundJobSubmissions')
      .withIndex('by_twilio_message_sid', (q) =>
        q.eq('twilioMessageSid', args.twilioMessageSid)
      )
      .first();

    if (existing) {
      console.log(`Duplicate SMS ignored: ${args.twilioMessageSid}`);
      return existing._id;
    }

    const id = await ctx.db.insert('inboundJobSubmissions', {
      phone: args.phone,
      rawText: args.rawText,
      twilioMessageSid: args.twilioMessageSid,
      status: 'pending',
      createdAt: Date.now(),
    });

    console.log(`Inbound job submission created: ${id} from ${args.phone}`);
    return id;
  },
});
