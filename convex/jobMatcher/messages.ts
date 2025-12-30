import { listUIMessages, syncStreams, vStreamArgs } from '@convex-dev/agent'
import { paginationOptsValidator } from 'convex/server'
import { v } from 'convex/values'

import { components } from '../_generated/api'
import { query } from '../_generated/server'

/**
 * List messages from a job search thread with streaming support
 */
export const listThreadMessages = query({
  args: {
    paginationOpts: paginationOptsValidator,
    streamArgs: vStreamArgs,
    threadId: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error('Not authenticated')

    // Verify user owns this thread by checking jobSearches
    const search = await ctx.db
      .query('jobSearches')
      .withIndex('by_thread_id', q => q.eq('threadId', args.threadId))
      .unique()

    if (!search || search.workosUserId !== identity.subject) {
      throw new Error('Thread not found or not authorized')
    }

    // Fetch messages with pagination
    const paginated = await listUIMessages(ctx, components.agent, {
      paginationOpts: args.paginationOpts,
      threadId: args.threadId,
    })

    // Sync streaming deltas
    const streams = await syncStreams(ctx, components.agent, {
      streamArgs: args.streamArgs,
      threadId: args.threadId,
    })

    return { ...paginated, streams }
  },
  returns: v.any(), // Complex paginated response with streams
})
