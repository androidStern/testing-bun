import { v } from 'convex/values'

import type { Doc } from './_generated/dataModel'
import { internalQuery } from './_generated/server'
import { authMutation, authQuery } from './functions'

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

export type JobSnapshot = NonNullable<Doc<'jobReviews'>['jobSnapshot']>

export const reviewJob = authMutation({
  args: {
    jobId: v.string(),
    jobSnapshot: v.optional(jobSnapshotValidator),
    status: v.union(v.literal('saved'), v.literal('skipped')),
  },
  handler: async (ctx, args) => {
    const workosUserId = ctx.user.subject

    const existing = await ctx.db
      .query('jobReviews')
      .withIndex('by_user_and_job', q => q.eq('workosUserId', workosUserId).eq('jobId', args.jobId))
      .unique()

    if (existing) {
      await ctx.db.patch(existing._id, {
        jobSnapshot: args.jobSnapshot,
        reviewedAt: Date.now(),
        status: args.status,
      })
      return existing._id
    }

    return await ctx.db.insert('jobReviews', {
      jobId: args.jobId,
      jobSnapshot: args.jobSnapshot,
      reviewedAt: Date.now(),
      status: args.status,
      workosUserId,
    })
  },
  returns: v.id('jobReviews'),
})

export const unsaveJob = authMutation({
  args: {
    jobId: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query('jobReviews')
      .withIndex('by_user_and_job', q =>
        q.eq('workosUserId', ctx.user.subject).eq('jobId', args.jobId),
      )
      .unique()

    if (!existing) {
      return { removed: false }
    }

    await ctx.db.delete(existing._id)
    return { removed: true }
  },
  returns: v.object({ removed: v.boolean() }),
})

export const getReviewedJobIds = authQuery({
  args: {},
  handler: async ctx => {
    const reviews = await ctx.db
      .query('jobReviews')
      .withIndex('by_user', q => q.eq('workosUserId', ctx.user.subject))
      .collect()
    return reviews.map(r => r.jobId)
  },
  returns: v.array(v.string()),
})

export const getSavedJobs = authQuery({
  args: {},
  handler: async ctx => {
    const savedJobs = await ctx.db
      .query('jobReviews')
      .withIndex('by_user_and_status', q =>
        q.eq('workosUserId', ctx.user.subject).eq('status', 'saved'),
      )
      .order('desc')
      .collect()

    return savedJobs.map(job => ({
      _id: job._id,
      jobId: job.jobId,
      jobSnapshot: job.jobSnapshot,
      reviewedAt: job.reviewedAt,
    }))
  },
  returns: v.array(
    v.object({
      _id: v.id('jobReviews'),
      jobId: v.string(),
      jobSnapshot: v.optional(jobSnapshotValidator),
      reviewedAt: v.number(),
    }),
  ),
})

export const getSavedJobsCount = authQuery({
  args: {},
  handler: async ctx => {
    const savedJobs = await ctx.db
      .query('jobReviews')
      .withIndex('by_user_and_status', q =>
        q.eq('workosUserId', ctx.user.subject).eq('status', 'saved'),
      )
      .collect()
    return savedJobs.length
  },
  returns: v.number(),
})

export const getReviewStats = authQuery({
  args: {},
  handler: async ctx => {
    const reviews = await ctx.db
      .query('jobReviews')
      .withIndex('by_user', q => q.eq('workosUserId', ctx.user.subject))
      .collect()

    const savedCount = reviews.filter(r => r.status === 'saved').length
    const skippedCount = reviews.filter(r => r.status === 'skipped').length

    return {
      reviewedCount: reviews.length,
      savedCount,
      skippedCount,
    }
  },
})

export const getReviewedJobIdsInternal = internalQuery({
  args: { workosUserId: v.string() },
  handler: async (ctx, args) => {
    const reviews = await ctx.db
      .query('jobReviews')
      .withIndex('by_user', q => q.eq('workosUserId', args.workosUserId))
      .collect()
    return reviews.map(r => r.jobId)
  },
  returns: v.array(v.string()),
})
