'use client'

import { convexQuery } from '@convex-dev/react-query'
import { useQuery } from '@tanstack/react-query'
import { useMutation } from 'convex/react'
import { Bookmark, Clock, DollarSign, ExternalLink, MapPin, Star, X } from 'lucide-react'
import { useCallback, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { cn } from '@/lib/utils'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'

interface SavedJobsDrawerProps {
  workosUserId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function SavedJobsDrawer({ workosUserId, open, onOpenChange }: SavedJobsDrawerProps) {
  const { data: savedJobs = [], refetch } = useQuery(
    convexQuery(api.savedJobs.getSavedJobs, { workosUserId }),
  )

  const unsaveJobMutation = useMutation(api.savedJobs.unsaveJobById)
  const [removingId, setRemovingId] = useState<Id<'savedJobs'> | null>(null)

  const handleRemove = useCallback(
    async (savedJobId: Id<'savedJobs'>) => {
      setRemovingId(savedJobId)
      try {
        await unsaveJobMutation({ savedJobId, workosUserId })
        refetch()
      } catch (error) {
        console.error('Failed to remove job:', error)
      } finally {
        setRemovingId(null)
      }
    },
    [unsaveJobMutation, workosUserId, refetch],
  )

  return (
    <Sheet onOpenChange={onOpenChange} open={open}>
      <SheetContent className='w-full sm:max-w-md overflow-y-auto'>
        <SheetHeader>
          <SheetTitle className='flex items-center gap-2'>
            <Bookmark className='h-5 w-5' />
            Saved Jobs ({savedJobs.length})
          </SheetTitle>
        </SheetHeader>

        <div className='mt-6 space-y-3'>
          {savedJobs.length === 0 ? (
            <div className='text-center py-12 text-muted-foreground'>
              <Bookmark className='h-12 w-12 mx-auto mb-3 opacity-20' />
              <p>No saved jobs yet</p>
              <p className='text-sm mt-1'>Swipe right on jobs you like to save them here</p>
            </div>
          ) : (
            savedJobs.map(saved => (
              <SavedJobCard
                isRemoving={removingId === saved._id}
                key={saved._id}
                onRemove={() => handleRemove(saved._id)}
                savedJob={saved}
              />
            ))
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}

interface SavedJobCardProps {
  savedJob: {
    _id: Id<'savedJobs'>
    jobId: string
    jobSnapshot: {
      title: string
      company: string
      location: string | null
      salary: string | null
      shifts: string[]
      isSecondChance: boolean
      url: string
    }
    savedAt: number
  }
  onRemove: () => void
  isRemoving: boolean
}

function SavedJobCard({ savedJob, onRemove, isRemoving }: SavedJobCardProps) {
  const { jobSnapshot } = savedJob

  return (
    <div className={cn('border rounded-lg p-3 transition-opacity', isRemoving && 'opacity-50')}>
      <div className='flex items-start justify-between gap-2'>
        <div className='min-w-0 flex-1'>
          <div className='flex items-center gap-2'>
            <h4 className='font-medium text-sm truncate'>{jobSnapshot.title}</h4>
            {jobSnapshot.isSecondChance && (
              <Star className='h-3.5 w-3.5 text-green-600 flex-shrink-0' />
            )}
          </div>
          <p className='text-sm text-muted-foreground truncate'>{jobSnapshot.company}</p>
        </div>

        <Button
          className='h-8 w-8 flex-shrink-0 text-muted-foreground hover:text-destructive'
          disabled={isRemoving}
          onClick={onRemove}
          size='icon'
          variant='ghost'
        >
          <X className='h-4 w-4' />
        </Button>
      </div>

      <div className='mt-2 space-y-1 text-xs text-muted-foreground'>
        {jobSnapshot.location && (
          <div className='flex items-center gap-1'>
            <MapPin className='h-3 w-3' />
            <span className='truncate'>{jobSnapshot.location}</span>
          </div>
        )}
        {jobSnapshot.salary && (
          <div className='flex items-center gap-1'>
            <DollarSign className='h-3 w-3' />
            <span>{jobSnapshot.salary}</span>
          </div>
        )}
        {jobSnapshot.shifts.length > 0 && (
          <div className='flex items-center gap-1'>
            <Clock className='h-3 w-3' />
            <span className='capitalize'>{jobSnapshot.shifts.slice(0, 2).join(', ')}</span>
          </div>
        )}
      </div>

      <div className='mt-3'>
        <Button asChild className='w-full h-8 text-xs' size='sm'>
          <a href={jobSnapshot.url} rel='noopener noreferrer' target='_blank'>
            Apply Now
            <ExternalLink className='ml-1.5 h-3 w-3' />
          </a>
        </Button>
      </div>
    </div>
  )
}
