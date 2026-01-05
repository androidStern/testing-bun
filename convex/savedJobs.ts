import { v } from 'convex/values'
import type { Doc } from './_generated/dataModel'
import { mutation, query } from './_generated/server'

const jobSnapshotValidator = v.object({
  busAccessible: v.boolean(),
  company: v.string(),
  isEasyApply: v.boolean(),
  isSecondChance: v.boolean(),
  isUrgent: v.boolean(),
  location: v.union(v.string(), v.null()),
  railAccessible: v.boolean(),
  salary: v.union(v.string(), v.null()),
  secondChanceTier: v.union(v.string(), v.null()),
  shifts: v.array(v.string()),
  title: v.string(),
  transitAccessible: v.boolean(),
  url: v.string(),
})

export type JobSnapshot = Doc<'savedJobs'>['jobSnapshot']

export const saveJob = mutation({
  args: {
    jobId: v.string(),
    jobSnapshot: jobSnapshotValidator,
    workosUserId: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query('savedJobs')
      .withIndex('by_user_and_job', q =>
        q.eq('workosUserId', args.workosUserId).eq('jobId', args.jobId),
      )
      .unique()

    if (existing) {
      return { alreadySaved: true, savedJobId: existing._id }
    }

    const savedJobId = await ctx.db.insert('savedJobs', {
      jobId: args.jobId,
      jobSnapshot: args.jobSnapshot,
      savedAt: Date.now(),
      workosUserId: args.workosUserId,
    })

    return { alreadySaved: false, savedJobId }
  },
  returns: v.object({
    alreadySaved: v.boolean(),
    savedJobId: v.optional(v.id('savedJobs')),
  }),
})

export const unsaveJob = mutation({
  args: {
    jobId: v.string(),
    workosUserId: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query('savedJobs')
      .withIndex('by_user_and_job', q =>
        q.eq('workosUserId', args.workosUserId).eq('jobId', args.jobId),
      )
      .unique()

    if (!existing) {
      return { removed: false }
    }

    await ctx.db.delete(existing._id)
    return { removed: true }
  },
  returns: v.object({
    removed: v.boolean(),
  }),
})

export const unsaveJobById = mutation({
  args: {
    savedJobId: v.id('savedJobs'),
    workosUserId: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db.get(args.savedJobId)

    if (!existing || existing.workosUserId !== args.workosUserId) {
      return { removed: false }
    }

    await ctx.db.delete(args.savedJobId)
    return { removed: true }
  },
  returns: v.object({
    removed: v.boolean(),
  }),
})

export const getSavedJobs = query({
  args: {
    workosUserId: v.string(),
  },
  handler: async (ctx, args) => {
    const savedJobs = await ctx.db
      .query('savedJobs')
      .withIndex('by_user', q => q.eq('workosUserId', args.workosUserId))
      .order('desc')
      .collect()

    return savedJobs.map(job => ({
      _id: job._id,
      jobId: job.jobId,
      jobSnapshot: job.jobSnapshot,
      savedAt: job.savedAt,
    }))
  },
})

export const getSavedJobsCount = query({
  args: {
    workosUserId: v.string(),
  },
  handler: async (ctx, args) => {
    const savedJobs = await ctx.db
      .query('savedJobs')
      .withIndex('by_user', q => q.eq('workosUserId', args.workosUserId))
      .collect()

    return savedJobs.length
  },
  returns: v.number(),
})

export const isJobSaved = query({
  args: {
    jobId: v.string(),
    workosUserId: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query('savedJobs')
      .withIndex('by_user_and_job', q =>
        q.eq('workosUserId', args.workosUserId).eq('jobId', args.jobId),
      )
      .unique()

    return existing !== null
  },
  returns: v.boolean(),
})

export const getSavedJobIds = query({
  args: {
    workosUserId: v.string(),
  },
  handler: async (ctx, args) => {
    const savedJobs = await ctx.db
      .query('savedJobs')
      .withIndex('by_user', q => q.eq('workosUserId', args.workosUserId))
      .collect()

    return savedJobs.map(job => job.jobId)
  },
  returns: v.array(v.string()),
})
