'use node'

import { v } from 'convex/values'

import { adminAction } from '../functions'

import { jobMatcherAgent } from './agent'

export const deleteMessage = adminAction({
  args: {
    messageId: v.string(),
  },
  handler: async (ctx, args) => {
    await jobMatcherAgent.deleteMessage(ctx, { messageId: args.messageId })
    return null
  },
  returns: v.null(),
})

export const deleteFromOrder = adminAction({
  args: {
    startOrder: v.number(),
    threadId: v.string(),
  },
  handler: async (ctx, args) => {
    const result = await jobMatcherAgent.deleteMessageRange(ctx, {
      endOrder: Number.MAX_SAFE_INTEGER,
      startOrder: args.startOrder,
      threadId: args.threadId,
    })

    if (!result.isDone) {
      console.warn(
        `[adminDeleteFromOrder] Large thread - partial deletion stopped at order ${result.lastOrder}`,
      )
    }

    return null
  },
  returns: v.null(),
})
