'use client'

import { convexQuery } from '@convex-dev/react-query'
import { useQuery } from '@tanstack/react-query'
import { Bookmark } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { api } from '../../../convex/_generated/api'

interface SavedJobsToggleProps {
  onClick: () => void
  className?: string
}

export function SavedJobsToggle({ onClick, className }: SavedJobsToggleProps) {
  const { data: count = 0 } = useQuery(convexQuery(api.jobReviews.getSavedJobsCount, {}))

  return (
    <Button className={cn('relative gap-2', className)} onClick={onClick} size='sm' variant='ghost'>
      <Bookmark className='h-4 w-4' />
      <span className='hidden sm:inline'>Saved</span>
      {count > 0 && (
        <span className='flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-xs font-medium text-primary-foreground'>
          {count > 99 ? '99+' : count}
        </span>
      )}
    </Button>
  )
}
