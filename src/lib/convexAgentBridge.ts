import type { ThreadMessageLike } from '@assistant-ui/react'
import type { UIMessage } from '@convex-dev/agent/react'

type ConvexUIMessage = UIMessage

export function convertConvexMessage(msg: ConvexUIMessage): ThreadMessageLike {
  const content = convertParts(msg.parts)

  const baseMessage = {
    content: content as ThreadMessageLike['content'],
    createdAt: new Date(msg._creationTime),
    // Use `key` as the stable identifier. The `id` field differs between
    // pending DB records and streaming updates (stream:xxx prefix), which
    // causes assistant-ui to create duplicate branches. `key` is stable
    // across both states. Store original id in metadata for promptMessageId.
    id: msg.key,
    metadata: {
      custom: {
        agentName: msg.agentName,
        convexId: msg.id, // Original Convex _id for promptMessageId
        key: msg.key,
        order: msg.order,
        stepOrder: msg.stepOrder,
      },
    },
    role: msg.role as 'assistant' | 'user' | 'system',
  }

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
      return { reason: 'stop', type: 'complete' }
    case 'error':
    case 'failed': {
      // Try to extract error message from the message
      const errorMessage = extractErrorMessage(msg)
      return {
        error: errorMessage,
        reason: 'error',
        type: 'incomplete',
      }
    }
    default:
      return { reason: 'stop', type: 'complete' }
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
  'tool-result', // Skip - causes phantom tool-calls when saved separately; results come via output field on tool-{name} parts
])

function convertParts(parts: ConvexUIMessage['parts']): readonly ContentPart[] {
  if (!parts || parts.length === 0) {
    return []
  }

  const result: Array<ContentPart> = []

  for (const part of parts) {
    if (INTERNAL_PART_TYPES.has(part.type)) {
      continue
    }

    if (part.type === 'text') {
      result.push({
        text: part.text,
        type: 'text',
      } as const)
      continue
    }

    if (part.type.startsWith('tool-') || 'toolName' in part) {
      const toolPart = part as {
        type: string
        toolName?: string
        toolCallId?: string
        input?: Record<string, unknown>
        output?: unknown
        state?: string
      }

      const toolName = toolPart.toolName ?? part.type.replace('tool-', '')
      const toolCallId = toolPart.toolCallId
      if (!toolCallId) {
        throw new Error(`Missing toolCallId for tool: ${toolName}`)
      }

      result.push({
        args: (toolPart.input ?? {}) as Readonly<Record<string, unknown>>,
        result: toolPart.output,
        toolCallId,
        toolName,
        type: 'tool-call',
      } as const)
      continue
    }

    if (part.type === 'reasoning') {
      const reasoningPart = part as { type: 'reasoning'; text: string }
      result.push({
        text: `[Thinking] ${reasoningPart.text}`,
        type: 'text',
      } as const)
      continue
    }
  }

  return result
}

/**
 * Type guard to check if a message is streaming.
 */
export function isMessageStreaming(msg: ConvexUIMessage): boolean {
  return msg.status === 'streaming' || msg.status === 'pending'
}
