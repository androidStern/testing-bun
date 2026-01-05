'use client'

import { cn } from '@/lib/utils'

interface ProgressBarProps {
  reviewed: number
  total: number
  saved: number
  className?: string
}

export function ProgressBar({ reviewed, total, saved, className }: ProgressBarProps) {
  const remaining = total - reviewed
  const progressPercent = total > 0 ? (reviewed / total) * 100 : 0

  return (
    <div className={cn('space-y-1.5', className)}>
      <div className='flex items-center justify-between text-xs'>
        <span className='text-muted-foreground'>
          {remaining > 0 ? `${remaining} remaining` : 'All reviewed!'}
        </span>
        <span className='font-medium text-green-600'>{saved} saved</span>
      </div>

      <div className='h-2 w-full rounded-full bg-secondary overflow-hidden'>
        <div
          className='h-full rounded-full bg-primary transition-all duration-300 ease-out'
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      <div className='flex items-center justify-between text-xs text-muted-foreground'>
        <span>
          {reviewed} / {total} reviewed
        </span>
        <span>{Math.round(progressPercent)}%</span>
      </div>
    </div>
  )
}
