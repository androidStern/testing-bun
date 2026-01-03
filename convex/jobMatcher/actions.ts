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

    console.log(
      `[JobMatcher] Starting search for user=${userId}, prompt="${args.prompt.substring(0, 50)}${args.prompt.length > 50 ? '...' : ''}"`,
    )

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

export const submitToolResult = action({
  args: {
    result: v.any(),
    threadId: v.string(),
    toolCallId: v.string(),
    toolName: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error('Not authenticated')

    console.log(
      `[DUPE-DEBUG] submitToolResult START: toolCallId=${args.toolCallId} toolName=${args.toolName}`,
    )

    const allMessages = await jobMatcherAgent.listMessages(ctx, {
      paginationOpts: { cursor: null, numItems: 100 },
      threadId: args.threadId,
    })

    console.log(`[DUPE-DEBUG] Found ${allMessages.page.length} messages in thread`)
    allMessages.page.forEach((msg, i) => {
      const content = msg.message?.content
      const parts = Array.isArray(content)
        ? content.map(p => {
            const part = p as { type?: string; toolCallId?: string; toolName?: string }
            return `${part.type}:${part.toolName || ''}:${part.toolCallId || ''}`
          })
        : []
      console.log(
        `[DUPE-DEBUG] msg[${i}] _id=${msg._id} order=${msg.order} stepOrder=${msg.stepOrder} parts=[${parts.join(', ')}]`,
      )
    })

    const toolCallMessage = allMessages.page.find(msg => {
      const content = msg.message?.content
      if (!Array.isArray(content)) return false
      return content.some(part => {
        if (typeof part !== 'object' || part === null) return false
        const p = part as { type?: string; toolCallId?: string }
        return p.type === 'tool-call' && p.toolCallId === args.toolCallId
      })
    })

    if (!toolCallMessage) {
      console.log(`[DUPE-DEBUG] ERROR: Tool call not found: ${args.toolCallId}`)
      throw new Error(`Tool call not found: ${args.toolCallId}`)
    }

    console.log(
      `[DUPE-DEBUG] Found toolCallMessage: _id=${toolCallMessage._id} order=${toolCallMessage.order} stepOrder=${toolCallMessage.stepOrder}`,
    )

    // Save the tool-result message (stays at same order as the tool-call)
    await jobMatcherAgent.saveMessage(ctx, {
      message: {
        content: [
          {
            result: args.result,
            toolCallId: args.toolCallId,
            toolName: args.toolName,
            type: 'tool-result',
          },
        ],
        role: 'tool',
      },
      promptMessageId: toolCallMessage._id,
      threadId: args.threadId,
    })

    console.log(`[DUPE-DEBUG] Saved tool-result message`)

    // Format the user's selection for display in conversation history
    const resultValue = args.result as { selectedOption?: string; selectedOptions?: string[] }
    const selectionText = resultValue.selectedOptions
      ? resultValue.selectedOptions.join(', ')
      : resultValue.selectedOption ?? JSON.stringify(args.result)

    // Save a synthetic user message to increment order (creates proper turn boundary)
    // This fixes the duplicate tool UI bug caused by all messages having order=0
    // The providerMetadata marker allows the frontend to render this as a compact chip
    const { messageId: userMessageId } = await jobMatcherAgent.saveMessage(ctx, {
      message: {
        content: selectionText,
        role: 'user',
      },
      metadata: {
        providerMetadata: {
          custom: { isSyntheticSelection: true },
        },
      },
      threadId: args.threadId,
    })

    console.log(`[DUPE-DEBUG] Saved synthetic user message: messageId=${userMessageId}`)

    const { thread } = await jobMatcherAgent.continueThread(ctx, {
      threadId: args.threadId,
      userId: identity.subject,
    })

    // Continue from the user message (new order) to properly separate conversation turns
    console.log(`[DUPE-DEBUG] Continuing thread from user message: promptMessageId=${userMessageId}`)
    await thread.streamText({ promptMessageId: userMessageId }, { saveStreamDeltas: true })
    console.log(`[DUPE-DEBUG] submitToolResult DONE`)

    return null
  },
  returns: v.null(),
})

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
