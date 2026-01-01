'use client'

import { Check, Loader2 } from 'lucide-react'
import { type ReactNode } from 'react'

import { cn } from '../../../lib/utils'

export interface ToolProgressStep {
  id: string
  label: string
  status: 'pending' | 'running' | 'complete' | 'error'
  detail?: string
}

export interface ToolProgressProps {
  title: string
  icon?: ReactNode
  steps?: Array<ToolProgressStep>
  status: 'running' | 'complete' | 'error'
  summary?: string
  className?: string
}

/**
 * ToolProgress component for displaying tool execution progress.
 * Shows a title, optional steps, and completion state.
 */
export function ToolProgress({
  title,
  icon,
  steps,
  status,
  summary,
  className,
}: ToolProgressProps) {
  const isRunning = status === 'running'

  return (
    <div className={cn('border bg-muted/30 p-3', className)}>
      {/* Header */}
      <div className="flex items-center gap-2">
        {isRunning ? (
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
        ) : status === 'complete' ? (
          <Check className="h-4 w-4 text-green-600" />
        ) : (
          icon
        )}
        <span className="text-sm font-medium">{title}</span>
      </div>

      {/* Steps */}
      {steps && steps.length > 0 && (
        <div className="mt-2 space-y-1 pl-6">
          {steps.map(step => (
            <div key={step.id} className="flex items-center gap-2 text-sm">
              {step.status === 'running' ? (
                <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
              ) : step.status === 'complete' ? (
                <Check className="h-3 w-3 text-green-600" />
              ) : step.status === 'error' ? (
                <span className="h-3 w-3 text-red-500">!</span>
              ) : (
                <span className="h-3 w-3 rounded-full border border-muted-foreground/30" />
              )}
              <span
                className={cn(
                  step.status === 'pending' && 'text-muted-foreground',
                  step.status === 'error' && 'text-red-500'
                )}
              >
                {step.label}
              </span>
              {step.detail && (
                <span className="text-muted-foreground text-xs">({step.detail})</span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Summary */}
      {summary && (
        <p className="mt-2 text-sm text-muted-foreground pl-6">{summary}</p>
      )}
    </div>
  )
}

/**
 * Simplified tool card for showing a single tool's status.
 */
export function ToolCard({
  icon,
  title,
  status,
  detail,
  className,
}: {
  icon: ReactNode
  title: string
  status: 'running' | 'complete' | 'error'
  detail?: string
  className?: string
}) {
  return (
    <div className={cn('mb-4 flex items-center gap-3 bg-muted/50 p-3 text-sm', className)}>
      <div className="flex-shrink-0">
        {status === 'running' ? (
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
        ) : status === 'complete' ? (
          <span className="text-green-600">{icon}</span>
        ) : (
          <span className="text-red-500">{icon}</span>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-medium">{title}</p>
        {detail && <p className="text-muted-foreground truncate">{detail}</p>}
      </div>
      {status === 'complete' && <Check className="h-4 w-4 text-green-600 flex-shrink-0" />}
    </div>
  )
}
