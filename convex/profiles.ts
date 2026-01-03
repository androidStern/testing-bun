import { v } from 'convex/values'
import { NoOp } from 'convex-helpers/server/customFunctions'
import { zCustomMutation } from 'convex-helpers/server/zod4'
import { z } from 'zod'

import { profileFormSchema, profileMutationSchema } from '../src/lib/schemas/profile'

import { internal } from './_generated/api'
import type { Id } from './_generated/dataModel'
import { internalMutation, internalQuery, mutation, query } from './_generated/server'

const zodMutation = zCustomMutation(mutation, NoOp)

// Profile document validator for return types
const profileDocValidator = v.object({
  _creationTime: v.number(),
  _id: v.id('profiles'),
  bio: v.optional(v.string()),
  createdAt: v.number(),
  email: v.string(),
  firstName: v.optional(v.string()),
  headline: v.optional(v.string()),
  homeLat: v.optional(v.number()),
  homeLon: v.optional(v.number()),
  instagramUrl: v.optional(v.string()),
  isochrones: v.optional(
    v.object({
      computedAt: v.number(),
      originLat: v.number(),
      originLon: v.number(),
      sixtyMinute: v.any(),
      tenMinute: v.any(),
      thirtyMinute: v.any(),
    }),
  ),
  lastName: v.optional(v.string()),
  linkedinUrl: v.optional(v.string()),
  location: v.optional(v.string()),
  referralCode: v.optional(v.string()),
  resumeLink: v.optional(v.string()),
  thingsICanOffer: v.array(v.string()),
  updatedAt: v.number(),
  website: v.optional(v.string()),
  workosUserId: v.string(),
})

// Internal query for workflow to fetch profile by ID
export const get = internalQuery({
  args: { id: v.id('profiles') },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id)
  },
  returns: v.union(profileDocValidator, v.null()),
})

export const getByWorkosUserId = query({
  args: { workosUserId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('profiles')
      .withIndex('by_workos_user_id', q => q.eq('workosUserId', args.workosUserId))
      .first()
  },
  returns: v.union(profileDocValidator, v.null()),
})

// Internal query for agent tools - returns same shape as public version
export const getByWorkosUserIdInternal = internalQuery({
  args: { workosUserId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('profiles')
      .withIndex('by_workos_user_id', q => q.eq('workosUserId', args.workosUserId))
      .unique()
  },
  returns: v.union(profileDocValidator, v.null()),
})

export const getByEmail = query({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('profiles')
      .withIndex('by_email', q => q.eq('email', args.email))
      .first()
  },
  returns: v.union(profileDocValidator, v.null()),
})

export const create = zodMutation({
  args: profileMutationSchema,
  handler: async (ctx, args) => {
    // Verify the authenticated user matches the workosUserId being created/updated
    const identity = await ctx.auth.getUserIdentity()
    if (!identity || identity.subject !== args.workosUserId) {
      throw new Error('Unauthorized: workosUserId does not match authenticated user')
    }

    // Schema transforms handle empty string -> undefined conversion
    const { referredByCode, ...profileData } = args

    const existing = await ctx.db
      .query('profiles')
      .withIndex('by_workos_user_id', q => q.eq('workosUserId', args.workosUserId))
      .first()

    const now = Date.now()

    let profileId: Id<'profiles'>
    let isNewProfile = false

    if (existing) {
      // Update existing profile (don't change referralCode)
      await ctx.db.patch(existing._id, {
        ...profileData,
        updatedAt: now,
      })
      profileId = existing._id
    } else {
      // New profile: generate unique referral code
      const referralCode = await ctx.runMutation(internal.referrals.generateUniqueCode, {})

      profileId = await ctx.db.insert('profiles', {
        ...profileData,
        createdAt: now,
        referralCode,
        updatedAt: now,
      })
      isNewProfile = true
    }

    // Record referral attribution if this is a new profile with a referral code
    if (isNewProfile && referredByCode) {
      await ctx.scheduler.runAfter(0, internal.referrals.recordReferral, {
        referredProfileId: profileId,
        referrerCode: referredByCode,
      })
    }

    // Send profile data to Inngest webhook
    await ctx.scheduler.runAfter(0, internal.profileWebhook.sendProfileWebhook, {
      bio: args.bio,
      email: args.email,
      firstName: args.firstName,
      headline: args.headline,
      instagramUrl: args.instagramUrl,
      lastName: args.lastName,
      linkedinUrl: args.linkedinUrl,
      location: args.location,
      resumeLink: args.resumeLink,
      thingsICanOffer: args.thingsICanOffer,
      website: args.website,
      workosUserId: args.workosUserId,
    })

    return profileId
  },
})

export const update = zodMutation({
  args: profileFormSchema.partial().required({ thingsICanOffer: true }).extend({
    workosUserId: profileMutationSchema.shape.workosUserId,
  }),
  handler: async (ctx, args) => {
    // Verify the authenticated user matches the workosUserId being updated
    const identity = await ctx.auth.getUserIdentity()
    if (!identity || identity.subject !== args.workosUserId) {
      throw new Error('Unauthorized: workosUserId does not match authenticated user')
    }

    // Schema transforms handle empty string -> undefined conversion
    const { workosUserId, ...updates } = args

    const profile = await ctx.db
      .query('profiles')
      .withIndex('by_workos_user_id', q => q.eq('workosUserId', workosUserId))
      .first()

    if (!profile) {
      throw new Error('Profile not found')
    }

    await ctx.db.patch(profile._id, {
      ...updates,
      updatedAt: Date.now(),
    })

    // Send updated profile data to Inngest webhook
    // Merge existing profile with updates
    const mergedProfile = { ...profile, ...updates }
    await ctx.scheduler.runAfter(0, internal.profileWebhook.sendProfileWebhook, {
      bio: mergedProfile.bio,
      email: profile.email,
      firstName: profile.firstName,
      headline: mergedProfile.headline,
      instagramUrl: mergedProfile.instagramUrl,
      lastName: profile.lastName,
      linkedinUrl: mergedProfile.linkedinUrl,
      location: mergedProfile.location,
      resumeLink: mergedProfile.resumeLink,
      thingsICanOffer: mergedProfile.thingsICanOffer,
      website: mergedProfile.website,
      workosUserId: profile.workosUserId,
    })

    return profile._id
  },
})

export const setHomeLocation = zodMutation({
  args: z.object({
    lat: z.number(),
    locationName: z.string().optional(),
    lon: z.number(),
  }),
  handler: async (ctx, { lat, lon, locationName }) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error('Not authenticated')

    const profile = await ctx.db
      .query('profiles')
      .withIndex('by_workos_user_id', q => q.eq('workosUserId', identity.subject))
      .unique()

    if (!profile) throw new Error('Profile not found')

    await ctx.db.patch(profile._id, {
      homeLat: lat,
      homeLon: lon,
      isochrones: undefined,
      location: locationName,
    })

    // Trigger isochrone computation via Inngest
    await ctx.scheduler.runAfter(0, internal.isochrones.triggerCompute, {
      lat,
      lon,
      profileId: profile._id,
    })

    return null
  },
  returns: z.null(),
})

export const saveIsochrones = internalMutation({
  args: {
    isochrones: v.object({
      computedAt: v.number(),
      sixtyMinute: v.any(),
      tenMinute: v.any(),
      thirtyMinute: v.any(),
    }),
    originLat: v.number(),
    originLon: v.number(),
    profileId: v.id('profiles'),
  },
  handler: async (ctx, { profileId, originLat, originLon, isochrones }) => {
    const profile = await ctx.db.get(profileId)

    if (!profile) {
      console.log('[saveIsochrones] Profile not found, skipping')
      return null
    }

    if (profile.homeLat !== originLat || profile.homeLon !== originLon) {
      console.log('[saveIsochrones] Stale computation (location changed), skipping')
      return null
    }

    await ctx.db.patch(profileId, {
      isochrones: {
        ...isochrones,
        originLat,
        originLon,
      },
    })
    return null
  },
  returns: v.null(),
})
