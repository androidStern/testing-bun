'use client'

import { convexQuery } from '@convex-dev/react-query'
import { useQuery } from '@tanstack/react-query'
import { CheckCircle2, ChevronDown, Circle, CircleDotDashed, XCircle } from 'lucide-react'
import { useEffect, useState } from 'react'

import { cn } from '@/lib/utils'

import { api } from '../../../convex/_generated/api'

interface PlanHeaderProps {
  threadId: string | null
  isAgentRunning: boolean
}

type TodoStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled'

interface Todo {
  id: string
  content: string
  status: TodoStatus
  priority: 'high' | 'medium' | 'low'
}

const STATUS_ICONS = {
  cancelled: XCircle,
  completed: CheckCircle2,
  in_progress: CircleDotDashed,
  pending: Circle,
}

const STATUS_STYLES = {
  cancelled: {
    icon: 'text-destructive/70',
    text: 'text-muted-foreground line-through',
  },
  completed: {
    icon: 'text-emerald-500',
    text: 'text-muted-foreground line-through',
  },
  in_progress: {
    icon: 'text-primary animate-spin',
    text: 'text-primary font-medium',
  },
  pending: {
    icon: 'text-muted-foreground',
    text: '',
  },
}

function TodoItem({ todo }: { todo: Todo }) {
  const Icon = STATUS_ICONS[todo.status]
  const styles = STATUS_STYLES[todo.status]

  return (
    <div className='flex items-center gap-2 py-1'>
      <Icon className={cn('h-4 w-4 shrink-0', styles.icon)} />
      <span className={cn('text-sm truncate', styles.text)}>{todo.content}</span>
    </div>
  )
}

export function PlanHeader({ threadId, isAgentRunning }: PlanHeaderProps) {
  const { data: plan } = useQuery(
    convexQuery(api.jobMatcher.plan.getPlan, threadId ? { threadId } : 'skip'),
  )

  const [isExpanded, setIsExpanded] = useState(false)

  useEffect(() => {
    if (isAgentRunning) {
      setIsExpanded(true)
    } else if (plan && plan.length > 0) {
      const timer = setTimeout(() => setIsExpanded(false), 1500)
      return () => clearTimeout(timer)
    }
  }, [isAgentRunning, plan])

  if (!plan || plan.length === 0) return null

  const completedCount = plan.filter(t => t.status === 'completed').length
  const cancelledCount = plan.filter(t => t.status === 'cancelled').length
  const activeCount = plan.length - cancelledCount
  const allComplete = completedCount === activeCount && activeCount > 0
  const progress = activeCount > 0 ? (completedCount / activeCount) * 100 : 0

  const currentTask = plan.find(t => t.status === 'in_progress')
  const nextPending = plan.find(t => t.status === 'pending')

  return (
    <div className='border-b bg-muted/30'>
      <button
        className='w-full px-4 py-2 flex items-center justify-between gap-3 hover:bg-muted/50 transition-colors'
        onClick={() => setIsExpanded(!isExpanded)}
        type='button'
      >
        <div className='flex items-center gap-3 min-w-0 flex-1'>
          <div className='flex items-center gap-2 shrink-0'>
            {allComplete ? (
              <CheckCircle2 className='h-4 w-4 text-emerald-500' />
            ) : isAgentRunning ? (
              <CircleDotDashed className='h-4 w-4 text-primary animate-spin' />
            ) : (
              <Circle className='h-4 w-4 text-muted-foreground' />
            )}
            <span className='text-sm text-muted-foreground'>
              {completedCount}/{activeCount}
            </span>
          </div>

          <span className='text-sm truncate'>
            {allComplete ? (
              <span className='text-emerald-600'>All tasks complete</span>
            ) : currentTask ? (
              <span className='text-primary'>{currentTask.content}</span>
            ) : nextPending ? (
              <span className='text-muted-foreground'>Next: {nextPending.content}</span>
            ) : null}
          </span>
        </div>

        <ChevronDown
          className={cn(
            'h-4 w-4 text-muted-foreground shrink-0 transition-transform',
            isExpanded && 'rotate-180',
          )}
        />
      </button>

      {isExpanded && (
        <div className='px-4 pb-3'>
          <div className='h-1.5 bg-muted rounded-full overflow-hidden mb-3'>
            <div
              className={cn(
                'h-full transition-all duration-500',
                allComplete ? 'bg-emerald-500' : 'bg-primary',
              )}
              style={{ width: `${progress}%` }}
            />
          </div>

          <div className='space-y-0.5'>
            {plan
              .filter(todo => todo.status !== 'cancelled')
              .map(todo => (
                <TodoItem key={todo.id} todo={todo} />
              ))}

            {cancelledCount > 0 && (
              <div className='text-xs text-muted-foreground mt-2'>
                {cancelledCount} task{cancelledCount !== 1 ? 's' : ''} cancelled
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
