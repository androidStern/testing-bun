import { listMessages } from '@convex-dev/agent'
import { v } from 'convex/values'

import { components } from '../_generated/api'
import { adminQuery } from '../functions'

import { jobMatcherAgent } from './agent'

export const listThreadMessages = adminQuery({
  args: {
    threadId: v.string(),
  },
  handler: async (ctx, args) => {
    const result = await listMessages(ctx, components.agent, {
      excludeToolMessages: false,
      paginationOpts: { cursor: null, numItems: 500 },
      threadId: args.threadId,
    })

    return result.page
  },
  returns: v.array(v.any()),
})

export const getDefaultInstructions = adminQuery({
  args: {},
  handler: async () => {
    return jobMatcherAgent.options.instructions ?? ''
  },
  returns: v.string(),
})
