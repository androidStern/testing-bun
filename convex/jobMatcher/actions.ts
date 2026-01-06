'use node'

import { v } from 'convex/values'

import { api, internal } from '../_generated/api'
import { type ActionCtx, action } from '../_generated/server'

import { jobMatcherAgent } from './agent'
import { buildUserContext } from './context'

async function isAdmin(ctx: ActionCtx, userId: string): Promise<boolean> {
  const profile = await ctx.runQuery(api.profiles.getByWorkosUserId, { workosUserId: userId })
  if (!profile?.email) return false
  const adminEmails = process.env.ADMIN_EMAILS?.split(',').map(e => e.trim().toLowerCase()) ?? []
  return adminEmails.includes(profile.email.toLowerCase())
}

/**
 * Start a new job search or continue an existing one
 */
export const startSearch = action({
  args: {
    prompt: v.string(),
    systemPromptOverride: v.optional(v.string()),
    threadId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error('Not authenticated')

    const userId = identity.subject

    console.log(
      `[JobMatcher] Starting search for user=${userId}, prompt="${args.prompt.substring(0, 50)}${args.prompt.length > 50 ? '...' : ''}"`,
    )

    const [resume, preferences, profile] = await Promise.all([
      ctx.runQuery(internal.resumes.getByWorkosUserIdInternal, { workosUserId: userId }),
      ctx.runQuery(internal.jobPreferences.getByWorkosUserIdInternal, { workosUserId: userId }),
      ctx.runQuery(internal.profiles.getByWorkosUserIdInternal, { workosUserId: userId }),
    ])

    const userContext = buildUserContext({
      preferences: preferences
        ? {
            maxCommuteMinutes: preferences.maxCommuteMinutes ?? undefined,
            preferSecondChance: preferences.preferSecondChance ?? undefined,
            requireSecondChance: preferences.requireSecondChance ?? undefined,
            shiftAfternoon: preferences.shiftAfternoon ?? undefined,
            shiftEvening: preferences.shiftEvening ?? undefined,
            shiftFlexible: preferences.shiftFlexible ?? undefined,
            shiftMorning: preferences.shiftMorning ?? undefined,
            shiftOvernight: preferences.shiftOvernight ?? undefined,
          }
        : null,
      profile,
      resume,
      searchCount: 0,
      sessionStarted: new Date(),
    })

    let systemPrompt = userContext
    if (args.systemPromptOverride && (await isAdmin(ctx, userId))) {
      systemPrompt = args.systemPromptOverride
    }

    if (args.threadId) {
      console.log(`[JobMatcher] Continuing thread=${args.threadId}`)

      const { thread } = await jobMatcherAgent.continueThread(ctx, {
        threadId: args.threadId,
        userId,
      })

      await thread.streamText(
        { prompt: args.prompt, system: systemPrompt },
        { saveStreamDeltas: true },
      )

      return { isNew: false, threadId: args.threadId }
    }

    const { thread, threadId } = await jobMatcherAgent.createThread(ctx, {
      userId,
    })
    console.log(`[JobMatcher] Created thread=${threadId}`)

    await ctx.runMutation(internal.jobMatcher.queries.createSearchRecord, {
      initialPrompt: args.prompt,
      threadId,
      workosUserId: userId,
    })

    await thread.streamText(
      { prompt: args.prompt, system: systemPrompt },
      { saveStreamDeltas: true },
    )

    return { isNew: true, threadId }
  },
  returns: v.object({
    isNew: v.boolean(),
    threadId: v.string(),
  }),
})

export const sendMessage = action({
  args: {
    message: v.string(),
    systemPromptOverride: v.optional(v.string()),
    threadId: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error('Not authenticated')

    const userId = identity.subject

    const [resume, preferences, profile] = await Promise.all([
      ctx.runQuery(internal.resumes.getByWorkosUserIdInternal, { workosUserId: userId }),
      ctx.runQuery(internal.jobPreferences.getByWorkosUserIdInternal, { workosUserId: userId }),
      ctx.runQuery(internal.profiles.getByWorkosUserIdInternal, { workosUserId: userId }),
    ])

    const userContext = buildUserContext({
      preferences: preferences
        ? {
            maxCommuteMinutes: preferences.maxCommuteMinutes ?? undefined,
            preferSecondChance: preferences.preferSecondChance ?? undefined,
            requireSecondChance: preferences.requireSecondChance ?? undefined,
            shiftAfternoon: preferences.shiftAfternoon ?? undefined,
            shiftEvening: preferences.shiftEvening ?? undefined,
            shiftFlexible: preferences.shiftFlexible ?? undefined,
            shiftMorning: preferences.shiftMorning ?? undefined,
            shiftOvernight: preferences.shiftOvernight ?? undefined,
          }
        : null,
      profile,
      resume,
      searchCount: 0,
      sessionStarted: new Date(),
    })

    let systemPrompt = userContext
    if (args.systemPromptOverride && (await isAdmin(ctx, userId))) {
      systemPrompt = args.systemPromptOverride
    }

    const { thread } = await jobMatcherAgent.continueThread(ctx, {
      threadId: args.threadId,
      userId,
    })

    await thread.streamText(
      { prompt: args.message, system: systemPrompt },
      { saveStreamDeltas: true },
    )

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
    systemPromptOverride: v.optional(v.string()),
    threadId: v.string(),
    toolCallId: v.string(),
    toolName: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error('Not authenticated')

    const userId = identity.subject

    console.log(`[submitToolResult] toolCallId=${args.toolCallId} toolName=${args.toolName}`)

    const allMessages = await jobMatcherAgent.listMessages(ctx, {
      paginationOpts: { cursor: null, numItems: 100 },
      threadId: args.threadId,
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
      throw new Error(`Tool call not found: ${args.toolCallId}`)
    }

    console.log(`[submitToolResult] Found tool call message: ${toolCallMessage._id}`)

    const [resume, preferences, profile] = await Promise.all([
      ctx.runQuery(internal.resumes.getByWorkosUserIdInternal, { workosUserId: userId }),
      ctx.runQuery(internal.jobPreferences.getByWorkosUserIdInternal, { workosUserId: userId }),
      ctx.runQuery(internal.profiles.getByWorkosUserIdInternal, { workosUserId: userId }),
    ])

    const userContext = buildUserContext({
      preferences: preferences
        ? {
            maxCommuteMinutes: preferences.maxCommuteMinutes ?? undefined,
            preferSecondChance: preferences.preferSecondChance ?? undefined,
            requireSecondChance: preferences.requireSecondChance ?? undefined,
            shiftAfternoon: preferences.shiftAfternoon ?? undefined,
            shiftEvening: preferences.shiftEvening ?? undefined,
            shiftFlexible: preferences.shiftFlexible ?? undefined,
            shiftMorning: preferences.shiftMorning ?? undefined,
            shiftOvernight: preferences.shiftOvernight ?? undefined,
          }
        : null,
      profile,
      resume,
      searchCount: 0,
      sessionStarted: new Date(),
    })

    let systemPrompt = userContext
    if (args.systemPromptOverride && (await isAdmin(ctx, userId))) {
      systemPrompt = args.systemPromptOverride
    }

    await jobMatcherAgent.continueThread(ctx, {
      threadId: args.threadId,
      userId,
    })

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
      threadId: args.threadId,
    })

    console.log(
      `[submitToolResult] Saved tool-result, continuing from original message: ${toolCallMessage._id}`,
    )

    await jobMatcherAgent.generateText(
      ctx,
      { threadId: args.threadId, userId },
      { promptMessageId: toolCallMessage._id, system: systemPrompt },
    )

    console.log(`[submitToolResult] Done`)

    return null
  },
  returns: v.null(),
})

export const forceSearch = action({
  args: {
    systemPromptOverride: v.optional(v.string()),
    threadId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error('Not authenticated')

    const userId = identity.subject
    const forcePrompt =
      'Search for jobs immediately using whatever information is available. Skip any questions and find the best matches based on my resume and preferences. If I have no resume, search for general entry-level positions.'

    console.log(`[JobMatcher] Force search for user=${userId}`)

    const [resume, preferences, profile] = await Promise.all([
      ctx.runQuery(internal.resumes.getByWorkosUserIdInternal, { workosUserId: userId }),
      ctx.runQuery(internal.jobPreferences.getByWorkosUserIdInternal, { workosUserId: userId }),
      ctx.runQuery(internal.profiles.getByWorkosUserIdInternal, { workosUserId: userId }),
    ])

    const userContext = buildUserContext({
      preferences: preferences
        ? {
            maxCommuteMinutes: preferences.maxCommuteMinutes ?? undefined,
            preferSecondChance: preferences.preferSecondChance ?? undefined,
            requireSecondChance: preferences.requireSecondChance ?? undefined,
            shiftAfternoon: preferences.shiftAfternoon ?? undefined,
            shiftEvening: preferences.shiftEvening ?? undefined,
            shiftFlexible: preferences.shiftFlexible ?? undefined,
            shiftMorning: preferences.shiftMorning ?? undefined,
            shiftOvernight: preferences.shiftOvernight ?? undefined,
          }
        : null,
      profile,
      resume,
      searchCount: 0,
      sessionStarted: new Date(),
    })

    let systemPrompt = userContext
    if (args.systemPromptOverride && (await isAdmin(ctx, userId))) {
      systemPrompt = args.systemPromptOverride
    }

    if (args.threadId) {
      console.log(`[JobMatcher] Force search on existing thread=${args.threadId}`)

      const { thread } = await jobMatcherAgent.continueThread(ctx, {
        threadId: args.threadId,
        userId,
      })

      await thread.streamText(
        { prompt: forcePrompt, system: systemPrompt },
        { saveStreamDeltas: true },
      )

      return { isNew: false, threadId: args.threadId }
    }

    const { thread, threadId } = await jobMatcherAgent.createThread(ctx, {
      userId,
    })
    console.log(`[JobMatcher] Created thread=${threadId} for force search`)

    await ctx.runMutation(internal.jobMatcher.queries.createSearchRecord, {
      initialPrompt: forcePrompt,
      threadId,
      workosUserId: userId,
    })

    await thread.streamText(
      { prompt: forcePrompt, system: systemPrompt },
      { saveStreamDeltas: true },
    )

    return { isNew: true, threadId }
  },
  returns: v.object({
    isNew: v.boolean(),
    threadId: v.string(),
  }),
})
