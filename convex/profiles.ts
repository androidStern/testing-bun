import { NoOp } from 'convex-helpers/server/customFunctions';
import { zCustomMutation } from 'convex-helpers/server/zod4';
import { v } from 'convex/values';
import { z } from 'zod';

import {
  profileFormSchema,
  profileMutationSchema,
} from '../src/lib/schemas/profile';

import { internal } from './_generated/api';
import { internalMutation, internalQuery, mutation, query } from './_generated/server';
import type { Id } from './_generated/dataModel';

const zodMutation = zCustomMutation(mutation, NoOp);

// Profile document validator for return types
const profileDocValidator = v.object({
  _id: v.id('profiles'),
  _creationTime: v.number(),
  workosUserId: v.string(),
  email: v.string(),
  firstName: v.optional(v.string()),
  lastName: v.optional(v.string()),
  thingsICanOffer: v.array(v.string()),
  headline: v.optional(v.string()),
  bio: v.optional(v.string()),
  resumeLink: v.optional(v.string()),
  location: v.optional(v.string()),
  website: v.optional(v.string()),
  instagramUrl: v.optional(v.string()),
  linkedinUrl: v.optional(v.string()),
  createdAt: v.number(),
  updatedAt: v.number(),
  referralCode: v.optional(v.string()),
  homeLat: v.optional(v.number()),
  homeLon: v.optional(v.number()),
  isochrones: v.optional(
    v.object({
      tenMinute: v.any(),
      thirtyMinute: v.any(),
      sixtyMinute: v.any(),
      computedAt: v.number(),
    }),
  ),
});

// Internal query for workflow to fetch profile by ID
export const get = internalQuery({
  args: { id: v.id('profiles') },
  returns: v.union(profileDocValidator, v.null()),
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

export const getByWorkosUserId = query({
  args: { workosUserId: v.string() },
  returns: v.union(profileDocValidator, v.null()),
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
  returns: v.union(profileDocValidator, v.null()),
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
    // Verify the authenticated user matches the workosUserId being created/updated
    const identity = await ctx.auth.getUserIdentity();
    if (!identity || identity.subject !== args.workosUserId) {
      throw new Error('Unauthorized: workosUserId does not match authenticated user');
    }

    // Schema transforms handle empty string -> undefined conversion
    const { referredByCode, ...profileData } = args;

    const existing = await ctx.db
      .query('profiles')
      .withIndex('by_workos_user_id', (q) =>
        q.eq('workosUserId', args.workosUserId),
      )
      .first();

    const now = Date.now();

    let profileId: Id<'profiles'>;
    let isNewProfile = false;

    if (existing) {
      // Update existing profile (don't change referralCode)
      await ctx.db.patch(existing._id, {
        ...profileData,
        updatedAt: now,
      });
      profileId = existing._id;
    } else {
      // New profile: generate unique referral code
      const referralCode = await ctx.runMutation(
        internal.referrals.generateUniqueCode,
        {},
      );

      profileId = await ctx.db.insert('profiles', {
        ...profileData,
        referralCode,
        createdAt: now,
        updatedAt: now,
      });
      isNewProfile = true;
    }

    // Record referral attribution if this is a new profile with a referral code
    if (isNewProfile && referredByCode) {
      await ctx.scheduler.runAfter(0, internal.referrals.recordReferral, {
        referrerCode: referredByCode,
        referredProfileId: profileId,
      });
    }

    // Send profile data to Inngest webhook
    await ctx.scheduler.runAfter(0, internal.profileWebhook.sendProfileWebhook, {
      workosUserId: args.workosUserId,
      email: args.email,
      firstName: args.firstName,
      lastName: args.lastName,
      thingsICanOffer: args.thingsICanOffer,
      headline: args.headline,
      bio: args.bio,
      location: args.location,
      website: args.website,
      resumeLink: args.resumeLink,
      linkedinUrl: args.linkedinUrl,
      instagramUrl: args.instagramUrl,
    });

    return profileId;
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
    // Verify the authenticated user matches the workosUserId being updated
    const identity = await ctx.auth.getUserIdentity();
    if (!identity || identity.subject !== args.workosUserId) {
      throw new Error('Unauthorized: workosUserId does not match authenticated user');
    }

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

    // Send updated profile data to Inngest webhook
    // Merge existing profile with updates
    const mergedProfile = { ...profile, ...updates };
    await ctx.scheduler.runAfter(0, internal.profileWebhook.sendProfileWebhook, {
      workosUserId: profile.workosUserId,
      email: profile.email,
      firstName: profile.firstName,
      lastName: profile.lastName,
      thingsICanOffer: mergedProfile.thingsICanOffer,
      headline: mergedProfile.headline,
      bio: mergedProfile.bio,
      location: mergedProfile.location,
      website: mergedProfile.website,
      resumeLink: mergedProfile.resumeLink,
      linkedinUrl: mergedProfile.linkedinUrl,
      instagramUrl: mergedProfile.instagramUrl,
    });

    return profile._id;
  },
});

// Set user's home location and trigger isochrone computation
export const setHomeLocation = zodMutation({
  args: z.object({
    lat: z.number(),
    lon: z.number(),
  }),
  returns: z.null(),
  handler: async (ctx, { lat, lon }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error('Not authenticated');

    const profile = await ctx.db
      .query('profiles')
      .withIndex('by_workos_user_id', (q) =>
        q.eq('workosUserId', identity.subject),
      )
      .unique();

    if (!profile) throw new Error('Profile not found');

    await ctx.db.patch(profile._id, {
      homeLat: lat,
      homeLon: lon,
      // Clear stale isochrones - will be recomputed
      isochrones: undefined,
    });

    // Trigger isochrone computation via Inngest
    await ctx.scheduler.runAfter(0, internal.isochrones.triggerCompute, {
      profileId: profile._id,
      lat,
      lon,
    });

    return null;
  },
});

// Internal mutation called by Inngest to save computed isochrones
export const saveIsochrones = internalMutation({
  args: {
    profileId: v.id('profiles'),
    isochrones: v.object({
      tenMinute: v.any(),
      thirtyMinute: v.any(),
      sixtyMinute: v.any(),
      computedAt: v.number(),
    }),
  },
  returns: v.null(),
  handler: async (ctx, { profileId, isochrones }) => {
    await ctx.db.patch(profileId, { isochrones });
    return null;
  },
});
