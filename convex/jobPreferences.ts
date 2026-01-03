import { v } from 'convex/values'

import { internalMutation, internalQuery, mutation, query } from './_generated/server'

// Validator for the job preferences document (reused in return types)
const jobPreferencesDocValidator = v.object({
  _creationTime: v.number(),
  _id: v.id('jobPreferences'),
  maxCommuteMinutes: v.optional(v.union(v.literal(10), v.literal(30), v.literal(60))),
  preferEasyApply: v.optional(v.boolean()),
  preferSecondChance: v.optional(v.boolean()),
  preferUrgent: v.optional(v.boolean()),
  requireBusAccessible: v.optional(v.boolean()),
  requirePublicTransit: v.optional(v.boolean()),
  requireRailAccessible: v.optional(v.boolean()),
  requireSecondChance: v.optional(v.boolean()),
  shiftAfternoon: v.optional(v.boolean()),
  shiftEvening: v.optional(v.boolean()),
  shiftFlexible: v.optional(v.boolean()),
  shiftMorning: v.optional(v.boolean()),
  shiftOvernight: v.optional(v.boolean()),
  updatedAt: v.number(),
  workosUserId: v.string(),
})

// Public query - get current user's preferences
export const get = query({
  args: {},
  handler: async ctx => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) return null

    return await ctx.db
      .query('jobPreferences')
      .withIndex('by_workos_user_id', q => q.eq('workosUserId', identity.subject))
      .unique()
  },
  returns: v.union(jobPreferencesDocValidator, v.null()),
})

// Internal query for agent tools
export const getByWorkosUserIdInternal = internalQuery({
  args: { workosUserId: v.string() },
  handler: async (ctx, { workosUserId }) => {
    return await ctx.db
      .query('jobPreferences')
      .withIndex('by_workos_user_id', q => q.eq('workosUserId', workosUserId))
      .unique()
  },
  returns: v.union(jobPreferencesDocValidator, v.null()),
})

// Upsert preferences
export const upsert = mutation({
  args: {
    maxCommuteMinutes: v.optional(v.union(v.literal(10), v.literal(30), v.literal(60), v.null())),
    preferEasyApply: v.optional(v.boolean()),
    preferSecondChance: v.optional(v.boolean()),
    preferUrgent: v.optional(v.boolean()),
    requireBusAccessible: v.optional(v.boolean()),
    requirePublicTransit: v.optional(v.boolean()),
    requireRailAccessible: v.optional(v.boolean()),
    requireSecondChance: v.optional(v.boolean()),
    shiftAfternoon: v.optional(v.boolean()),
    shiftEvening: v.optional(v.boolean()),
    shiftFlexible: v.optional(v.boolean()),
    shiftMorning: v.optional(v.boolean()),
    shiftOvernight: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error('Not authenticated')

    const existing = await ctx.db
      .query('jobPreferences')
      .withIndex('by_workos_user_id', q => q.eq('workosUserId', identity.subject))
      .unique()

    const data = {
      ...args,
      // Convert null to undefined so the field is removed from the document
      maxCommuteMinutes: args.maxCommuteMinutes === null ? undefined : args.maxCommuteMinutes,
      updatedAt: Date.now(),
      workosUserId: identity.subject,
    }

    if (existing) {
      await ctx.db.patch(existing._id, data)
      return existing._id
    }

    return await ctx.db.insert('jobPreferences', data)
  },
  returns: v.id('jobPreferences'),
})

export const upsertInternal = internalMutation({
  args: {
    maxCommuteMinutes: v.optional(v.union(v.literal(10), v.literal(30), v.literal(60))),
    requirePublicTransit: v.optional(v.boolean()),
    workosUserId: v.string(),
  },
  handler: async (ctx, args) => {
    const { workosUserId, ...updates } = args

    const existing = await ctx.db
      .query('jobPreferences')
      .withIndex('by_workos_user_id', q => q.eq('workosUserId', workosUserId))
      .unique()

    const data = {
      ...updates,
      updatedAt: Date.now(),
      workosUserId,
    }

    if (existing) {
      await ctx.db.patch(existing._id, data)
      return existing._id
    }

    return await ctx.db.insert('jobPreferences', data)
  },
  returns: v.id('jobPreferences'),
})
