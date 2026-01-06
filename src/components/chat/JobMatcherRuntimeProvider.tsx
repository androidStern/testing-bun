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
  onError?: (error: string) => void
  systemPromptOverride?: string | null
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  if (typeof error === 'string') return error
  return 'An unexpected error occurred'
}

export function JobMatcherRuntimeProvider({
  threadId,
  children,
  onThreadCreated,
  onError,
  systemPromptOverride,
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
      const interactiveTools = ['collectLocation', 'collectResume', 'askQuestion', 'askPreference']
      if (threadId && interactiveTools.includes(options.toolName)) {
        try {
          await submitToolResultAction({
            result: options.result,
            systemPromptOverride: systemPromptOverride ?? undefined,
            threadId,
            toolCallId: options.toolCallId,
            toolName: options.toolName,
          })
        } catch (err) {
          console.error('Submit tool result failed:', err)
          onError?.(getErrorMessage(err))
        }
      }
    },
    [threadId, submitToolResultAction, onError, systemPromptOverride],
  )

  const handleNewMessage = useCallback(
    async (message: AppendMessage) => {
      const textPart = message.content.find(p => p.type === 'text')
      const text = textPart && 'text' in textPart ? textPart.text : ''

      if (!text.trim()) return

      try {
        if (threadId) {
          await sendMessageAction({
            message: text,
            systemPromptOverride: systemPromptOverride ?? undefined,
            threadId,
          })
        } else {
          const result = await startSearchAction({
            prompt: text,
            systemPromptOverride: systemPromptOverride ?? undefined,
          })
          onThreadCreated?.(result.threadId)
        }
      } catch (err) {
        console.error('Send message failed:', err)
        onError?.(getErrorMessage(err))
      }
    },
    [
      threadId,
      sendMessageAction,
      startSearchAction,
      onThreadCreated,
      onError,
      systemPromptOverride,
    ],
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
