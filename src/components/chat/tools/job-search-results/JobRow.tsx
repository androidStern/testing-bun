'use client'

import { ChevronDown, ChevronRight, ExternalLink } from 'lucide-react'

import { Button } from '@/components/ui/button'
import type { SearchJobResult } from '@/lib/schemas/job'
import { cn } from '@/lib/utils'

const SHIFT_ICONS: Record<string, string> = {
  afternoon: '🌤️',
  evening: '🌙',
  flexible: '⚡',
  morning: '☀️',
  overnight: '🌑',
}

interface JobRowProps {
  job: SearchJobResult
  isExpanded: boolean
  onToggle: () => void
}

export function JobRow({ job, isExpanded, onToggle }: JobRowProps) {
  const isTransitAccessible = job.transitAccessible || job.busAccessible || job.railAccessible

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onToggle()
    }
  }

  const renderIcons = () => (
    <span className='flex flex-shrink-0 items-center gap-0.5'>
      {job.isSecondChance && <span title='Fair Chance Employer'>⭐</span>}
      {isTransitAccessible && <span title='Transit Accessible'>🚌</span>}
      {job.shifts.map(
        shift =>
          SHIFT_ICONS[shift] && (
            <span key={shift} title={shift}>
              {SHIFT_ICONS[shift]}
            </span>
          ),
      )}
    </span>
  )

  return (
    <div className='border-b border-border/50 last:border-b-0'>
      <div
        aria-expanded={isExpanded}
        className={cn(
          'flex min-h-11 cursor-pointer items-start gap-2 px-3 py-2 transition-colors hover:bg-muted/50',
          'sm:items-center sm:px-4 sm:py-0',
          isExpanded && 'bg-muted/30',
        )}
        onClick={onToggle}
        onKeyDown={handleKeyDown}
        role='button'
        tabIndex={0}
      >
        {isExpanded ? (
          <ChevronDown className='mt-0.5 h-4 w-4 flex-shrink-0 text-muted-foreground sm:mt-0' />
        ) : (
          <ChevronRight className='mt-0.5 h-4 w-4 flex-shrink-0 text-muted-foreground sm:mt-0' />
        )}

        {/* Mobile: stacked two-line layout */}
        <div className='flex min-w-0 flex-1 flex-col gap-0.5 sm:hidden'>
          <div className='flex items-center gap-2'>
            <span className='line-clamp-1 font-medium'>
              {job.title}
              {job.company && job.company !== 'Unknown Employer' && (
                <span className='font-normal text-muted-foreground'> at {job.company}</span>
              )}
            </span>
            {renderIcons()}
          </div>
          <span className='text-xs text-muted-foreground'>
            {job.location}
            {job.salary && ` · ${job.salary}`}
          </span>
        </div>

        {/* Desktop: single line layout */}
        <div className='hidden min-w-0 flex-1 sm:flex sm:items-center sm:gap-1.5'>
          <span className='truncate font-medium'>{job.title}</span>
          <span className='text-muted-foreground'>·</span>
          <span className='truncate text-muted-foreground'>{job.company}</span>
          {job.location && (
            <>
              <span className='text-muted-foreground'>·</span>
              <span className='truncate text-muted-foreground'>{job.location}</span>
            </>
          )}
          {job.salary && (
            <>
              <span className='text-muted-foreground'>·</span>
              <span className='truncate text-muted-foreground'>{job.salary}</span>
            </>
          )}
          <span className='ml-1'>{renderIcons()}</span>
        </div>

        <Button
          asChild
          className='flex-shrink-0'
          onClick={e => e.stopPropagation()}
          size='sm'
          variant='outline'
        >
          <a href={job.url} rel='noopener noreferrer' target='_blank'>
            <span className='hidden sm:inline'>Apply</span>
            <ExternalLink className='h-3.5 w-3.5 sm:ml-1' />
          </a>
        </Button>
      </div>

      {isExpanded && (
        <div className='space-y-1.5 bg-muted/20 px-4 py-3 pl-9 text-sm sm:pl-10'>
          {job.location && (
            <div className='flex items-center gap-2'>
              <span>📍</span>
              <span>{job.location}</span>
            </div>
          )}
          {job.salary && (
            <div className='flex items-center gap-2'>
              <span>💰</span>
              <span>{job.salary}</span>
            </div>
          )}
          {job.shifts.length > 0 && (
            <div className='flex items-center gap-2'>
              <span>⏰</span>
              <span className='capitalize'>{job.shifts.join(', ')} shifts</span>
            </div>
          )}
          {job.isSecondChance && (
            <div className='flex items-center gap-2'>
              <span>⭐</span>
              <span>Fair Chance Employer</span>
            </div>
          )}
          {isTransitAccessible && (
            <div className='flex items-center gap-2'>
              <span>🚌</span>
              <span>Transit Accessible</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
