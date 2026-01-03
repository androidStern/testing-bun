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
import { type ReactNode, useCallback, useEffect, useMemo, useRef } from 'react'

import { api } from '../../../convex/_generated/api'
import { convertConvexMessage, isMessageStreaming } from '../../lib/convexAgentBridge'

let debugCounter = 0
function debugLog(tag: string, data: unknown) {
  const id = ++debugCounter
  const ts = new Date().toISOString()
  console.log(`[DUPE-DEBUG-${id}] [${ts}] [${tag}]`, JSON.stringify(data, null, 2))
}

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

  const prevMsgCount = useRef(0)
  useEffect(() => {
    if (!messages?.length) return
    if (messages.length === prevMsgCount.current) return
    prevMsgCount.current = messages.length

    debugLog('RAW_MESSAGES', {
      count: messages.length,
      messages: messages.map(m => ({
        id: m.id,
        key: m.key,
        order: m.order,
        parts: m.parts?.map(p => ({
          state: 'state' in p ? p.state : undefined,
          toolCallId: 'toolCallId' in p ? p.toolCallId : undefined,
          toolName: 'toolName' in p ? p.toolName : undefined,
          type: p.type,
        })),
        partsCount: m.parts?.length,
        role: m.role,
        status: m.status,
        stepOrder: m.stepOrder,
        text: m.text?.substring(0, 50),
      })),
      threadId,
    })
  }, [messages, threadId])

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

  const prevConvCount = useRef(0)
  useEffect(() => {
    if (!convertedMessages?.length) return
    if (convertedMessages.length === prevConvCount.current) return
    prevConvCount.current = convertedMessages.length

    debugLog('CONVERTED_MESSAGES', {
      count: convertedMessages.length,
      messages: convertedMessages.map(m => ({
        content: Array.isArray(m.content)
          ? m.content.map(c => ({
              toolCallId: 'toolCallId' in c ? c.toolCallId : undefined,
              toolName: 'toolName' in c ? c.toolName : undefined,
              type: c.type,
            }))
          : [],
        contentCount: Array.isArray(m.content) ? m.content.length : 0,
        id: m.id,
        role: m.role,
      })),
      threadId,
    })
  }, [convertedMessages, threadId])

  const handleAddToolResult = useCallback(
    async (options: AddToolResultOptions) => {
      debugLog('ADD_TOOL_RESULT_CALLED', {
        messageId: options.messageId,
        result: options.result,
        threadId,
        toolCallId: options.toolCallId,
        toolName: options.toolName,
      })

      const interactiveTools = ['collectLocation', 'askQuestion']
      if (threadId && interactiveTools.includes(options.toolName)) {
        debugLog('SUBMITTING_TOOL_RESULT', { threadId, toolCallId: options.toolCallId })
        await submitToolResultAction({
          result: options.result,
          threadId,
          toolCallId: options.toolCallId,
          toolName: options.toolName,
        })
        debugLog('TOOL_RESULT_SUBMITTED', { threadId, toolCallId: options.toolCallId })
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
