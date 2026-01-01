/**
 * Bridge between Convex Agent UIMessages and assistant-ui ThreadMessageLike format.
 *
 * Convex Agent extends AI SDK's UIMessage with:
 * - key: unique identifier
 * - order: message ordering
 * - stepOrder: step within a message
 * - status: 'streaming' | 'pending' | 'success' | 'error'
 * - agentName: optional agent identifier
 * - text: combined text content
 * - _creationTime: timestamp
 *
 * assistant-ui ThreadMessageLike expects:
 * - role: 'assistant' | 'user' | 'system'
 * - content: string | array of parts
 * - id: optional string
 * - createdAt: optional Date
 * - status: MessageStatus object
 */

import type { ThreadMessageLike } from '@assistant-ui/react'
import type { UIMessage } from '@convex-dev/agent/react'

type ConvexUIMessage = UIMessage

/**
 * Converts a Convex Agent UIMessage to assistant-ui ThreadMessageLike format.
 */
export function convertConvexMessage(msg: ConvexUIMessage, idx: number): ThreadMessageLike {
  // Convert parts from AI SDK format to assistant-ui format
  const content = convertParts(msg.parts)

  // Base message properties
  const baseMessage = {
    id: msg.key,
    role: msg.role as 'assistant' | 'user' | 'system',
    createdAt: new Date(msg._creationTime),
    // Cast content to satisfy the union type - we know our ContentPart structure is correct
    content: content as ThreadMessageLike['content'],
    metadata: {
      custom: {
        agentName: msg.agentName,
        order: msg.order,
        stepOrder: msg.stepOrder,
      },
    },
  }

  // Only add status for assistant messages (assistant-ui requirement)
  if (msg.role === 'assistant') {
    return {
      ...baseMessage,
      status: mapStatus(msg.status, msg),
    }
  }

  return baseMessage
}

/**
 * Maps Convex Agent status to assistant-ui MessageStatus.
 * Convex Agent status can be: 'streaming' | 'pending' | 'success' | 'error' | 'failed'
 *
 * For error states, extracts error message from message parts if available.
 */
function mapStatus(status: string, msg?: ConvexUIMessage): ThreadMessageLike['status'] {
  switch (status) {
    case 'streaming':
    case 'pending':
      return { type: 'running' }
    case 'success':
      return { type: 'complete', reason: 'stop' }
    case 'error':
    case 'failed': {
      // Try to extract error message from the message
      const errorMessage = extractErrorMessage(msg)
      return {
        type: 'incomplete',
        reason: 'error',
        error: errorMessage,
      }
    }
    default:
      return { type: 'complete', reason: 'stop' }
  }
}

/**
 * Attempts to extract an error message from a failed message.
 * Checks text content and tool call errors.
 */
function extractErrorMessage(msg?: ConvexUIMessage): string {
  if (!msg) {
    return 'An unexpected error occurred. Please try again.'
  }

  // Check if the message text contains error information
  if (msg.text && msg.text.length > 0) {
    // If the text looks like an error message, use it
    const text = msg.text.trim()
    if (text.toLowerCase().includes('error') || text.toLowerCase().includes('failed')) {
      return text.length > 200 ? text.substring(0, 200) + '...' : text
    }
  }

  // Check tool call parts for errors
  for (const part of msg.parts ?? []) {
    if ('state' in part && part.state === 'output-error' && 'errorText' in part) {
      const errorText = part.errorText as string
      return errorText.length > 200 ? errorText.substring(0, 200) + '...' : errorText
    }
  }

  // Default error message
  return 'Something went wrong. Please try again.'
}

/**
 * Content part types that assistant-ui accepts.
 * Using readonly to match ThreadMessageLike content type.
 */
type TextPart = { readonly type: 'text'; readonly text: string }
type ToolCallPart = {
  readonly type: 'tool-call'
  readonly toolCallId: string
  readonly toolName: string
  readonly args: Readonly<Record<string, unknown>>
  readonly result?: unknown
}
type ContentPart = TextPart | ToolCallPart

/**
 * Internal part types that should be silently ignored.
 * These are AI SDK implementation details, not user-facing content.
 */
const INTERNAL_PART_TYPES = new Set([
  'step-start',
  'step-finish',
  'source',
  'file',
])

/**
 * Converts AI SDK UIMessage parts to assistant-ui content parts.
 */
function convertParts(parts: ConvexUIMessage['parts']): readonly ContentPart[] {
  if (!parts || parts.length === 0) {
    return []
  }

  const result: ContentPart[] = []

  for (const part of parts) {
    // Skip internal/implementation parts
    if (INTERNAL_PART_TYPES.has(part.type)) {
      continue
    }

    // Handle text parts
    if (part.type === 'text') {
      result.push({
        type: 'text',
        text: part.text,
      } as const)
      continue
    }

    // Handle tool call parts (AI SDK uses 'tool-{toolName}' prefix pattern)
    if (part.type.startsWith('tool-') || 'toolName' in part) {
      const toolPart = part as {
        type: string
        toolName?: string
        toolCallId?: string
        input?: Record<string, unknown>
        output?: unknown
        state?: string
      }

      // Extract tool name from type (e.g., 'tool-searchJobs' -> 'searchJobs')
      const toolName = toolPart.toolName ?? part.type.replace('tool-', '')

      result.push({
        type: 'tool-call',
        toolCallId: toolPart.toolCallId ?? `${toolName}-${Date.now()}`,
        toolName,
        args: (toolPart.input ?? {}) as Readonly<Record<string, unknown>>,
        result: toolPart.output,
      } as const)
      continue
    }

    // Handle reasoning parts - convert to text
    if (part.type === 'reasoning') {
      const reasoningPart = part as { type: 'reasoning'; text: string }
      result.push({
        type: 'text',
        text: `[Thinking] ${reasoningPart.text}`,
      } as const)
      continue
    }

    // Skip unknown parts silently - they're likely internal implementation details
    // Log for debugging but don't pollute the UI
    console.debug('[convexAgentBridge] Skipping unknown part type:', part.type)
  }

  return result
}

/**
 * Type guard to check if a message is streaming.
 */
export function isMessageStreaming(msg: ConvexUIMessage): boolean {
  return msg.status === 'streaming' || msg.status === 'pending'
}
