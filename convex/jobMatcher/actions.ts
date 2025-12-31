'use node'

import { v } from 'convex/values'

import { internal } from '../_generated/api'
import { action } from '../_generated/server'

import { jobMatcherAgent } from './agent'

/**
 * Start a new job search or continue an existing one
 */
export const startSearch = action({
  args: {
    prompt: v.string(),
    threadId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error('Not authenticated')

    const userId = identity.subject

    console.log(`[JobMatcher] Starting search for user=${userId}, prompt="${args.prompt.substring(0, 50)}${args.prompt.length > 50 ? '...' : ''}"`)

    // If continuing existing thread
    if (args.threadId) {
      console.log(`[JobMatcher] Continuing thread=${args.threadId}`)

      const { thread } = await jobMatcherAgent.continueThread(ctx, {
        threadId: args.threadId,
        userId,
      })

      // Stream agent response - tool results (including job cards) are rendered by the UI
      await thread.streamText({ prompt: args.prompt }, { saveStreamDeltas: true })

      return { isNew: false, threadId: args.threadId }
    }

    // Create new thread
    const { thread, threadId } = await jobMatcherAgent.createThread(ctx, {
      userId,
    })
    console.log(`[JobMatcher] Created thread=${threadId}`)

    // Record the search
    await ctx.runMutation(internal.jobMatcher.queries.createSearchRecord, {
      initialPrompt: args.prompt,
      threadId,
      workosUserId: userId,
    })

    // Stream agent response - tool results (including job cards) are rendered by the UI
    await thread.streamText({ prompt: args.prompt }, { saveStreamDeltas: true })

    return { isNew: true, threadId }
  },
  returns: v.object({
    isNew: v.boolean(),
    threadId: v.string(),
  }),
})

/**
 * Send a follow-up message to an existing search
 */
export const sendMessage = action({
  args: {
    message: v.string(),
    threadId: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error('Not authenticated')

    const { thread } = await jobMatcherAgent.continueThread(ctx, {
      threadId: args.threadId,
      userId: identity.subject,
    })

    // Stream agent response - tool results (including job cards) are rendered by the UI
    await thread.streamText({ prompt: args.message }, { saveStreamDeltas: true })

    return null
  },
  returns: v.null(),
})

/**
 * Cancel an active search
 */
export const cancelSearch = action({
  args: {
    searchId: v.id('jobSearches'),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error('Not authenticated')

    await ctx.runMutation(internal.jobMatcher.queries.markSearchCancelled, {
      searchId: args.searchId,
      workosUserId: identity.subject,
    })

    return null
  },
  returns: v.null(),
})

/**
 * Force a job search immediately, bypassing Q&A flow
 * Used when user clicks "Search Now" button in header
 */
export const forceSearch = action({
  args: {
    threadId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error('Not authenticated')

    const userId = identity.subject
    const forcePrompt =
      'Search for jobs immediately using whatever information is available. Skip any questions and find the best matches based on my resume and preferences. If I have no resume, search for general entry-level positions.'

    console.log(`[JobMatcher] Force search for user=${userId}`)

    // If continuing existing thread
    if (args.threadId) {
      console.log(`[JobMatcher] Force search on existing thread=${args.threadId}`)

      const { thread } = await jobMatcherAgent.continueThread(ctx, {
        threadId: args.threadId,
        userId,
      })

      // Stream agent response - tool results (including job cards) are rendered by the UI
      await thread.streamText({ prompt: forcePrompt }, { saveStreamDeltas: true })

      return { isNew: false, threadId: args.threadId }
    }

    // Create new thread
    const { thread, threadId } = await jobMatcherAgent.createThread(ctx, {
      userId,
    })
    console.log(`[JobMatcher] Created thread=${threadId} for force search`)

    // Record the search
    await ctx.runMutation(internal.jobMatcher.queries.createSearchRecord, {
      initialPrompt: forcePrompt,
      threadId,
      workosUserId: userId,
    })

    // Stream agent response - tool results (including job cards) are rendered by the UI
    await thread.streamText({ prompt: forcePrompt }, { saveStreamDeltas: true })

    return { isNew: true, threadId }
  },
  returns: v.object({
    isNew: v.boolean(),
    threadId: v.string(),
  }),
})
