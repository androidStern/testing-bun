'use node'

import { v } from 'convex/values'

import { internal } from '../_generated/api'
import { action } from '../_generated/server'

import { jobMatcherAgent } from './agent'
import { jobResultsSchema } from './schema'

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

      // Phase 1: Run tools with streaming
      await thread.streamText({ prompt: args.prompt }, { saveStreamDeltas: true })

      // Phase 2: Generate structured output
      await thread.generateObject({
        prompt:
          'Format the job search results from above into the required JSON structure. Include all matching jobs found, a summary of the search, and any suggestions for improving results.',
        schema: jobResultsSchema,
      })

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

    // Phase 1: Run tools with streaming
    await thread.streamText({ prompt: args.prompt }, { saveStreamDeltas: true })

    // Phase 2: Generate structured output
    await thread.generateObject({
      prompt:
        'Format the job search results from above into the required JSON structure. Include all matching jobs found, a summary of the search, and any suggestions for improving results.',
      schema: jobResultsSchema,
    })

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

    // Phase 1: Run tools with streaming
    await thread.streamText({ prompt: args.message }, { saveStreamDeltas: true })

    // Phase 2: Generate structured output
    await thread.generateObject({
      prompt:
        'Format the job search results from above into the required JSON structure. Include all matching jobs found, a summary of the search, and any suggestions for improving results.',
      schema: jobResultsSchema,
    })

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
