import { v } from 'convex/values'

import { internalMutation, internalQuery, query } from '../_generated/server'

export const todoValidator = v.object({
  content: v.string(),
  id: v.string(),
  priority: v.union(v.literal('high'), v.literal('medium'), v.literal('low')),
  status: v.union(
    v.literal('pending'),
    v.literal('in_progress'),
    v.literal('completed'),
    v.literal('cancelled'),
  ),
})

export const updatePlan = internalMutation({
  args: {
    threadId: v.string(),
    todos: v.array(todoValidator),
  },
  handler: async (ctx, args) => {
    const search = await ctx.db
      .query('jobSearches')
      .withIndex('by_thread_id', q => q.eq('threadId', args.threadId))
      .unique()

    if (search) {
      await ctx.db.patch(search._id, { plan: args.todos })
    }
    return null
  },
  returns: v.null(),
})

export const getPlan = query({
  args: { threadId: v.string() },
  handler: async (ctx, args) => {
    const search = await ctx.db
      .query('jobSearches')
      .withIndex('by_thread_id', q => q.eq('threadId', args.threadId))
      .unique()

    return search?.plan ?? null
  },
  returns: v.union(v.null(), v.array(todoValidator)),
})

export const getPlanInternal = internalQuery({
  args: { threadId: v.string() },
  handler: async (ctx, args) => {
    const search = await ctx.db
      .query('jobSearches')
      .withIndex('by_thread_id', q => q.eq('threadId', args.threadId))
      .unique()

    return search?.plan ?? null
  },
  returns: v.union(v.null(), v.array(todoValidator)),
})
