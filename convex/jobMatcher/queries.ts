import { v } from 'convex/values'

import { internalMutation, query } from '../_generated/server'

/**
 * Get the user's active job search (if any)
 */
export const getActiveSearch = query({
  args: {},
  handler: async ctx => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) return null

    return await ctx.db
      .query('jobSearches')
      .withIndex('by_workos_user_id_status', q =>
        q.eq('workosUserId', identity.subject).eq('status', 'active'),
      )
      .first()
  },
  returns: v.union(
    v.object({
      _creationTime: v.number(),
      _id: v.id('jobSearches'),
      completedAt: v.optional(v.number()),
      initialPrompt: v.string(),
      plan: v.optional(
        v.array(
          v.object({
            content: v.string(),
            id: v.string(),
            priority: v.union(v.literal('high'), v.literal('medium'), v.literal('low')),
            status: v.union(
              v.literal('pending'),
              v.literal('in_progress'),
              v.literal('completed'),
              v.literal('cancelled'),
            ),
          }),
        ),
      ),
      startedAt: v.number(),
      status: v.string(),
      threadId: v.string(),
      workosUserId: v.string(),
    }),
    v.null(),
  ),
})

/**
 * Get all job searches for the current user (for history)
 */
export const listSearches = query({
  args: {},
  handler: async ctx => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) return []

    return await ctx.db
      .query('jobSearches')
      .withIndex('by_workos_user_id', q => q.eq('workosUserId', identity.subject))
      .order('desc')
      .collect()
  },
  returns: v.array(
    v.object({
      _creationTime: v.number(),
      _id: v.id('jobSearches'),
      completedAt: v.optional(v.number()),
      initialPrompt: v.string(),
      plan: v.optional(
        v.array(
          v.object({
            content: v.string(),
            id: v.string(),
            priority: v.union(v.literal('high'), v.literal('medium'), v.literal('low')),
            status: v.union(
              v.literal('pending'),
              v.literal('in_progress'),
              v.literal('completed'),
              v.literal('cancelled'),
            ),
          }),
        ),
      ),
      startedAt: v.number(),
      status: v.string(),
      threadId: v.string(),
      workosUserId: v.string(),
    }),
  ),
})

/**
 * Internal mutation to create a job search record
 */
export const createSearchRecord = internalMutation({
  args: {
    initialPrompt: v.string(),
    threadId: v.string(),
    workosUserId: v.string(),
  },
  handler: async (ctx, args) => {
    // Mark any existing active searches as completed
    const existing = await ctx.db
      .query('jobSearches')
      .withIndex('by_workos_user_id_status', q =>
        q.eq('workosUserId', args.workosUserId).eq('status', 'active'),
      )
      .collect()

    for (const search of existing) {
      await ctx.db.patch(search._id, {
        completedAt: Date.now(),
        status: 'completed',
      })
    }

    // Create new search record
    return await ctx.db.insert('jobSearches', {
      initialPrompt: args.initialPrompt,
      startedAt: Date.now(),
      status: 'active',
      threadId: args.threadId,
      workosUserId: args.workosUserId,
    })
  },
  returns: v.id('jobSearches'),
})

export const markSearchCompleted = internalMutation({
  args: {
    threadId: v.string(),
  },
  handler: async (ctx, args) => {
    const search = await ctx.db
      .query('jobSearches')
      .withIndex('by_thread_id', q => q.eq('threadId', args.threadId))
      .unique()

    if (search && search.status === 'active') {
      await ctx.db.patch(search._id, {
        completedAt: Date.now(),
        status: 'completed',
      })
    }

    return null
  },
  returns: v.null(),
})

export const markSearchCancelled = internalMutation({
  args: {
    searchId: v.id('jobSearches'),
    workosUserId: v.string(),
  },
  handler: async (ctx, args) => {
    const search = await ctx.db.get(args.searchId)
    if (!search || search.workosUserId !== args.workosUserId) {
      throw new Error('Search not found or not authorized')
    }

    await ctx.db.patch(args.searchId, {
      completedAt: Date.now(),
      status: 'cancelled',
    })

    return null
  },
  returns: v.null(),
})
