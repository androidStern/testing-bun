'use client'

import {
  AssistantRuntimeProvider,
  useExternalStoreRuntime,
  type AppendMessage,
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
  // Subscribe to thread messages with streaming support
  const { results: messages, status: paginationStatus } = useUIMessages(
    api.jobMatcher.messages.listThreadMessages,
    threadId ? { threadId } : 'skip',
    { initialNumItems: 50, stream: true }
  )

  // Get Convex actions for sending messages
  const startSearchAction = useAction(api.jobMatcher.actions.startSearch)
  const sendMessageAction = useAction(api.jobMatcher.actions.sendMessage)

  // Check if any message is currently streaming
  const isRunning = useMemo(() => {
    if (!messages?.length) return false
    return messages.some(msg => isMessageStreaming(msg))
  }, [messages])

  // Convert messages to assistant-ui format
  const convertedMessages = useMemo(() => {
    if (!messages?.length) return []
    return messages.map((msg, idx) => convertConvexMessage(msg, idx))
  }, [messages])

  // Handle new messages from the user
  const handleNewMessage = useCallback(
    async (message: AppendMessage) => {
      // Extract text from message content
      const textPart = message.content.find(p => p.type === 'text')
      const text = textPart && 'text' in textPart ? textPart.text : ''

      if (!text.trim()) return

      if (threadId) {
        // Continue existing thread
        await sendMessageAction({
          message: text,
          threadId,
        })
      } else {
        // Start new search (creates thread)
        const result = await startSearchAction({
          prompt: text,
        })
        // Notify parent of new thread ID
        onThreadCreated?.(result.threadId)
      }
    },
    [threadId, sendMessageAction, startSearchAction, onThreadCreated]
  )

  // Create the external store runtime
  const runtime = useExternalStoreRuntime({
    messages: convertedMessages,
    isRunning,
    isLoading: paginationStatus === 'LoadingFirstPage',
    onNew: handleNewMessage,
    // Identity function since we already converted messages to ThreadMessageLike
    convertMessage: (msg) => msg,
  })

  return <AssistantRuntimeProvider runtime={runtime}>{children}</AssistantRuntimeProvider>
}
