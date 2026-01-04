'use client'

import {
  type AddToolResultOptions,
  type AppendMessage,
  AssistantRuntimeProvider,
  useExternalMessageConverter,
  useExternalStoreRuntime,
} from '@assistant-ui/react'
import { useUIMessages } from '@convex-dev/agent/react'
import { useAction } from 'convex/react'
import { type ReactNode, useCallback, useMemo } from 'react'

import { api } from '../../../convex/_generated/api'
import { convertConvexMessage, isMessageStreaming } from '../../lib/convexAgentBridge'

interface JobMatcherRuntimeProviderProps {
  threadId: string | null
  children: ReactNode
  onThreadCreated?: (threadId: string) => void
}

/**
 * Provides assistant-ui runtime by bridging Convex Agent messages.
 *
 * This component:
 * 1. Subscribes to Convex Agent thread messages via useUIMessages
 * 2. Converts them to assistant-ui ThreadMessageLike format
 * 3. Creates an external store runtime that assistant-ui components can use
 * 4. Handles sending new messages via Convex actions
 */
export function JobMatcherRuntimeProvider({
  threadId,
  children,
  onThreadCreated,
}: JobMatcherRuntimeProviderProps) {
  const { results: messages, status: paginationStatus } = useUIMessages(
    api.jobMatcher.messages.listThreadMessages,
    threadId ? { threadId } : 'skip',
    { initialNumItems: 50, stream: true },
  )

  const startSearchAction = useAction(api.jobMatcher.actions.startSearch)
  const sendMessageAction = useAction(api.jobMatcher.actions.sendMessage)
  const submitToolResultAction = useAction(api.jobMatcher.actions.submitToolResult)

  const isRunning = useMemo(() => {
    if (!messages?.length) return false
    return messages.some(msg => isMessageStreaming(msg))
  }, [messages])

  const convertedMessages = useExternalMessageConverter({
    callback: convertConvexMessage,
    isRunning,
    joinStrategy: 'none',
    messages: messages ?? [],
  })

  const handleAddToolResult = useCallback(
    async (options: AddToolResultOptions) => {
      const interactiveTools = ['collectLocation', 'askQuestion']
      if (threadId && interactiveTools.includes(options.toolName)) {
        await submitToolResultAction({
          result: options.result,
          threadId,
          toolCallId: options.toolCallId,
          toolName: options.toolName,
        })
      }
    },
    [threadId, submitToolResultAction],
  )

  const handleNewMessage = useCallback(
    async (message: AppendMessage) => {
      const textPart = message.content.find(p => p.type === 'text')
      const text = textPart && 'text' in textPart ? textPart.text : ''

      if (!text.trim()) return

      if (threadId) {
        await sendMessageAction({
          message: text,
          threadId,
        })
      } else {
        const result = await startSearchAction({
          prompt: text,
        })
        onThreadCreated?.(result.threadId)
      }
    },
    [threadId, sendMessageAction, startSearchAction, onThreadCreated],
  )

  const runtime = useExternalStoreRuntime({
    isLoading: paginationStatus === 'LoadingFirstPage',
    isRunning,
    messages: convertedMessages,
    onAddToolResult: handleAddToolResult,
    onNew: handleNewMessage,
  })

  return <AssistantRuntimeProvider runtime={runtime}>{children}</AssistantRuntimeProvider>
}
