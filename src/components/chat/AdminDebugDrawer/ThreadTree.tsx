'use client'

import { convexQuery } from '@convex-dev/react-query'
import { useQuery } from '@tanstack/react-query'
import { useAction } from 'convex/react'
import { ChevronDown, ChevronRight, MessageSquare, Trash2, Wrench } from 'lucide-react'
import { useCallback, useState } from 'react'

import { api } from '../../../../convex/_generated/api'
import { Button } from '../../ui/button'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '../../ui/collapsible'
import { ScrollArea } from '../../ui/scroll-area'

interface ThreadTreeProps {
  threadId: string | null
}

type MessageDoc = {
  _id: string
  order: number
  stepOrder: number
  status: string
  message?: {
    role: string
    content: string | ContentPart[]
  }
}

type ContentPart =
  | { type: 'text'; text: string }
  | { type: 'tool-call'; toolCallId: string; toolName: string; args: unknown }
  | { type: 'tool-result'; toolCallId: string; toolName: string; result: unknown }

function getMessageTitle(msg: MessageDoc): string {
  const role = msg.message?.role ?? 'unknown'
  const content = msg.message?.content

  if (typeof content === 'string') {
    const preview = content.slice(0, 40)
    return `${role}: ${preview}${content.length > 40 ? '...' : ''}`
  }

  if (Array.isArray(content)) {
    for (const part of content) {
      if (part.type === 'text') {
        const preview = part.text.slice(0, 30)
        return `${role}: ${preview}${part.text.length > 30 ? '...' : ''}`
      }
      if (part.type === 'tool-call') {
        return `${part.toolName}()`
      }
      if (part.type === 'tool-result') {
        return `${part.toolName} result`
      }
    }
  }

  return `${role} message`
}

function getRoleIcon(role: string) {
  if (role === 'user') return <MessageSquare className='h-3 w-3 text-blue-500' />
  if (role === 'assistant') return <MessageSquare className='h-3 w-3 text-green-500' />
  if (role === 'tool') return <Wrench className='h-3 w-3 text-orange-500' />
  return <MessageSquare className='h-3 w-3 text-muted-foreground' />
}

function MessageNode({
  message,
  onDelete,
}: {
  message: MessageDoc
  onDelete: (messageId: string) => void
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  const handleDelete = useCallback(async () => {
    setIsDeleting(true)
    await onDelete(message._id)
    setIsDeleting(false)
  }, [message._id, onDelete])

  const title = getMessageTitle(message)
  const role = message.message?.role ?? 'unknown'

  return (
    <Collapsible onOpenChange={setIsOpen} open={isOpen}>
      <div className='flex items-center gap-1 py-0.5 group w-full overflow-hidden relative pr-6'>
        <CollapsibleTrigger asChild>
          <Button className='h-5 w-5 p-0' size='sm' variant='ghost'>
            {isOpen ? <ChevronDown className='h-3 w-3' /> : <ChevronRight className='h-3 w-3' />}
          </Button>
        </CollapsibleTrigger>

        {getRoleIcon(role)}

        <span className='text-xs truncate flex-1 min-w-0' title={title}>
          {title}
        </span>

        <Button
          className='h-5 w-5 p-0 text-destructive absolute right-0 top-1/2 -translate-y-1/2'
          disabled={isDeleting}
          onClick={handleDelete}
          size='sm'
          variant='ghost'
        >
          <Trash2 className='h-3 w-3 text-red-500' />
        </Button>
      </div>

      <CollapsibleContent>
        <pre className='text-[10px] bg-muted p-2 rounded ml-6 overflow-x-auto max-h-32 overflow-y-auto'>
          {JSON.stringify(message.message?.content, null, 2)}
        </pre>
      </CollapsibleContent>
    </Collapsible>
  )
}

interface TurnGroup {
  order: number
  messages: MessageDoc[]
}

function groupByOrder(messages: MessageDoc[]): TurnGroup[] {
  const groups = new Map<number, MessageDoc[]>()

  for (const msg of messages) {
    const existing = groups.get(msg.order) ?? []
    existing.push(msg)
    groups.set(msg.order, existing)
  }

  return Array.from(groups.entries())
    .sort(([a], [b]) => a - b)
    .map(([order, msgs]) => ({
      messages: msgs.sort((a, b) => a.stepOrder - b.stepOrder),
      order,
    }))
}

export function ThreadTree({ threadId }: ThreadTreeProps) {
  const { data: messages, refetch } = useQuery(
    convexQuery(api.jobMatcher.admin.listThreadMessages, threadId ? { threadId } : 'skip'),
  )

  const deleteMessageAction = useAction(api.jobMatcher.adminNode.deleteMessage)

  const handleDelete = useCallback(
    async (messageId: string) => {
      await deleteMessageAction({ messageId })
      refetch()
    },
    [deleteMessageAction, refetch],
  )

  if (!threadId) {
    return <div className='text-xs text-muted-foreground p-2'>No active thread</div>
  }

  if (!messages) {
    return <div className='text-xs text-muted-foreground p-2'>Loading...</div>
  }

  const turns = groupByOrder(messages as MessageDoc[])

  if (turns.length === 0) {
    return <div className='text-xs text-muted-foreground p-2'>No messages</div>
  }

  return (
    <ScrollArea className='h-full'>
      <div className='p-2 space-y-2 overflow-hidden'>
        {turns.map(turn => (
          <div className='border-l-2 border-muted pl-2 overflow-hidden' key={turn.order}>
            <div className='text-[10px] text-muted-foreground mb-1'>Turn {turn.order}</div>
            {turn.messages.map(msg => (
              <MessageNode key={msg._id} message={msg} onDelete={handleDelete} />
            ))}
          </div>
        ))}
      </div>
    </ScrollArea>
  )
}
