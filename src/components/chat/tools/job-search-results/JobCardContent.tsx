'use client'

import { Bus, Clock, DollarSign, ExternalLink, MapPin, Star, Train, Zap } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { LayoutMode } from '@/components/ui/morphing-card-stack'
import type { SearchJobResult } from '@/lib/schemas/job'
import { cn } from '@/lib/utils'

const SHIFT_LABELS: Record<string, { icon: string; label: string }> = {
  afternoon: { icon: '🌤️', label: 'Afternoon' },
  evening: { icon: '🌙', label: 'Evening' },
  flexible: { icon: '⚡', label: 'Flexible' },
  morning: { icon: '☀️', label: 'Morning' },
  overnight: { icon: '🌑', label: 'Overnight' },
}

interface JobCardContentProps {
  job: SearchJobResult
  layout: LayoutMode
  showApplyButton?: boolean
}

export function JobCardContent({ job, layout, showApplyButton = true }: JobCardContentProps) {
  const isCompact = layout === 'list'
  const isStack = layout === 'stack'

  return (
    <div className={cn('flex flex-col h-full', isStack && 'min-h-[280px]')}>
      <div className={cn('p-4 flex-1', isStack && 'pb-2')}>
        <div className='flex items-start justify-between gap-2 mb-2'>
          <div className='min-w-0 flex-1'>
            <h3
              className={cn(
                'font-semibold text-card-foreground',
                isCompact ? 'text-sm truncate' : 'text-base line-clamp-2',
              )}
            >
              {job.title}
            </h3>
            <p className='text-sm text-muted-foreground truncate'>{job.company}</p>
          </div>

          {job.isSecondChance && (
            <Badge className='bg-green-100 text-green-800 flex-shrink-0 gap-1' variant='secondary'>
              <Star className='h-3 w-3' />
              {!isCompact && 'Fair Chance'}
            </Badge>
          )}
        </div>

        <div className={cn('space-y-2', isCompact && 'space-y-1')}>
          {job.location && (
            <div className='flex items-center gap-1.5 text-sm text-muted-foreground'>
              <MapPin className='h-3.5 w-3.5 flex-shrink-0' />
              <span className='truncate'>{job.location}</span>
            </div>
          )}

          {job.salary && (
            <div className='flex items-center gap-1.5 text-sm text-muted-foreground'>
              <DollarSign className='h-3.5 w-3.5 flex-shrink-0' />
              <span className='truncate'>{job.salary}</span>
            </div>
          )}

          {!isCompact && job.shifts.length > 0 && (
            <div className='flex items-center gap-1.5'>
              <Clock className='h-3.5 w-3.5 text-muted-foreground flex-shrink-0' />
              <div className='flex flex-wrap gap-1'>
                {job.shifts.slice(0, 3).map(shift => {
                  const shiftInfo = SHIFT_LABELS[shift.toLowerCase()]
                  return (
                    <Badge className='text-xs py-0 px-1.5' key={shift} variant='outline'>
                      {shiftInfo?.icon} {shiftInfo?.label || shift}
                    </Badge>
                  )
                })}
              </div>
            </div>
          )}

          {!isCompact && (job.busAccessible || job.railAccessible || job.transitAccessible) && (
            <div className='flex items-center gap-2 text-xs text-muted-foreground'>
              {job.busAccessible && (
                <span className='flex items-center gap-0.5'>
                  <Bus className='h-3 w-3' /> Bus
                </span>
              )}
              {job.railAccessible && (
                <span className='flex items-center gap-0.5'>
                  <Train className='h-3 w-3' /> Rail
                </span>
              )}
            </div>
          )}

          {!isCompact && (job.isUrgent || job.isEasyApply) && (
            <div className='flex flex-wrap gap-1'>
              {job.isUrgent && (
                <Badge className='text-xs py-0' variant='destructive'>
                  <Zap className='h-3 w-3 mr-0.5' /> Urgent
                </Badge>
              )}
              {job.isEasyApply && (
                <Badge className='text-xs py-0' variant='secondary'>
                  Easy Apply
                </Badge>
              )}
            </div>
          )}
        </div>
      </div>

      {showApplyButton && (
        <div className='p-4 pt-2 mt-auto'>
          <Button asChild className='w-full' size='sm'>
            <a href={job.url} rel='noopener noreferrer' target='_blank'>
              Apply
              <ExternalLink className='ml-1.5 h-3.5 w-3.5' />
            </a>
          </Button>
        </div>
      )}
    </div>
  )
}
