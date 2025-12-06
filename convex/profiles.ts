import { NoOp } from 'convex-helpers/server/customFunctions';
import { zCustomMutation } from 'convex-helpers/server/zod4';
import { v } from 'convex/values';

import {
  profileFormSchema,
  profileMutationSchema,
} from '../src/lib/schemas/profile';

import { mutation, query } from './_generated/server';

const zodMutation = zCustomMutation(mutation, NoOp);

export const getByWorkosUserId = query({
  args: { workosUserId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('profiles')
      .withIndex('by_workos_user_id', (q) =>
        q.eq('workosUserId', args.workosUserId),
      )
      .first();
  },
});

export const getByEmail = query({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('profiles')
      .withIndex('by_email', (q) => q.eq('email', args.email))
      .first();
  },
});

export const create = zodMutation({
  args: profileMutationSchema,
  handler: async (ctx, args) => {
    // Schema transforms handle empty string -> undefined conversion
    const existing = await ctx.db
      .query('profiles')
      .withIndex('by_workos_user_id', (q) =>
        q.eq('workosUserId', args.workosUserId),
      )
      .first();

    const now = Date.now();

    if (existing) {
      await ctx.db.patch(existing._id, {
        ...args,
        updatedAt: now,
      });
      return existing._id;
    }

    return await ctx.db.insert('profiles', {
      ...args,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const update = zodMutation({
  args: profileFormSchema
    .partial()
    .required({ thingsICanOffer: true })
    .extend({
      workosUserId: profileMutationSchema.shape.workosUserId,
    }),
  handler: async (ctx, args) => {
    // Schema transforms handle empty string -> undefined conversion
    const { workosUserId, ...updates } = args;

    const profile = await ctx.db
      .query('profiles')
      .withIndex('by_workos_user_id', (q) => q.eq('workosUserId', workosUserId))
      .first();

    if (!profile) {
      throw new Error('Profile not found');
    }

    await ctx.db.patch(profile._id, {
      ...updates,
      updatedAt: Date.now(),
    });

    return profile._id;
  },
});
