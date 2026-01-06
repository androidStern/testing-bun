'use client'

import { convexQuery } from '@convex-dev/react-query'
import { useQuery as useTanstackQuery } from '@tanstack/react-query'
import { useMutation } from 'convex/react'
import { Check, Undo2, X } from 'lucide-react'
import { useCallback, useMemo, useState } from 'react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { type CardData, MorphingCardStack } from '@/components/ui/morphing-card-stack'
import type { SearchJobResult } from '@/lib/schemas/job'
import { api } from '../../../../../convex/_generated/api'

import { JobCardContent } from './JobCardContent'
import { ProgressBar } from './ProgressBar'

interface JobReviewModalProps {
  jobs: Array<SearchJobResult>
  open: boolean
  onComplete: (savedCount: number, skippedCount: number) => void
}

export function JobReviewModal({ jobs, open, onComplete }: JobReviewModalProps) {
  const [isCompleting, setIsCompleting] = useState(false)
  const [lastAction, setLastAction] = useState<{
    jobId: string
    status: 'saved' | 'skipped'
  } | null>(null)

  const { data: reviewedJobIds = [] } = useTanstackQuery(
    convexQuery(api.jobReviews.getReviewedJobIds, {}),
  )

  const { data: stats } = useTanstackQuery(convexQuery(api.jobReviews.getReviewStats, {}))

  const reviewJobMutation = useMutation(api.jobReviews.reviewJob).withOptimisticUpdate(
    (localStore, args) => {
      const { jobId, status } = args

      const currentIds = localStore.getQuery(api.jobReviews.getReviewedJobIds, {})
      if (currentIds !== undefined) {
        localStore.setQuery(api.jobReviews.getReviewedJobIds, {}, [...currentIds, jobId])
      }

      const currentStats = localStore.getQuery(api.jobReviews.getReviewStats, {})
      if (currentStats !== undefined) {
        localStore.setQuery(
          api.jobReviews.getReviewStats,
          {},
          {
            ...currentStats,
            reviewedCount: currentStats.reviewedCount + 1,
            savedCount: status === 'saved' ? currentStats.savedCount + 1 : currentStats.savedCount,
            skippedCount:
              status === 'skipped' ? currentStats.skippedCount + 1 : currentStats.skippedCount,
          },
        )
      }
    },
  )

  const undoMutation = useMutation(api.jobReviews.unsaveJob).withOptimisticUpdate(
    (localStore, args) => {
      const { jobId } = args

      const currentIds = localStore.getQuery(api.jobReviews.getReviewedJobIds, {})
      if (currentIds !== undefined) {
        localStore.setQuery(
          api.jobReviews.getReviewedJobIds,
          {},
          currentIds.filter(id => id !== jobId),
        )
      }

      const currentStats = localStore.getQuery(api.jobReviews.getReviewStats, {})
      if (currentStats !== undefined && lastAction) {
        localStore.setQuery(
          api.jobReviews.getReviewStats,
          {},
          {
            ...currentStats,
            reviewedCount: currentStats.reviewedCount - 1,
            savedCount:
              lastAction.status === 'saved' ? currentStats.savedCount - 1 : currentStats.savedCount,
            skippedCount:
              lastAction.status === 'skipped'
                ? currentStats.skippedCount - 1
                : currentStats.skippedCount,
          },
        )
      }
    },
  )

  const reviewedIdsSet = useMemo(() => new Set(reviewedJobIds), [reviewedJobIds])

  const jobIdsInThisSearch = useMemo(() => new Set(jobs.map(j => j.id)), [jobs])

  const reviewedInThisSearch = useMemo(
    () => new Set([...reviewedIdsSet].filter(id => jobIdsInThisSearch.has(id))),
    [reviewedIdsSet, jobIdsInThisSearch],
  )

  const remainingCount = jobs.length - reviewedInThisSearch.size
  const reviewedCount = reviewedInThisSearch.size
  const savedCount = stats?.savedCount ?? 0
  const skippedCount = stats?.skippedCount ?? 0

  const isAllReviewed = remainingCount === 0
  const showSkipButton = reviewedCount >= 1 && remainingCount > 0

  const handleSwipeRight = useCallback(
    async (card: CardData) => {
      const job = jobs.find(j => j.id === card.id)
      if (!job) return

      await reviewJobMutation({
        jobId: job.id,
        jobSnapshot: {
          busAccessible: job.busAccessible,
          company: job.company,
          isEasyApply: job.isEasyApply,
          isSecondChance: job.isSecondChance,
          isUrgent: job.isUrgent,
          location: job.location,
          railAccessible: job.railAccessible,
          salary: job.salary,
          secondChanceTier: job.secondChanceTier,
          shifts: job.shifts,
          title: job.title,
          transitAccessible: job.transitAccessible,
          url: job.url,
        },
        status: 'saved',
      })
      setLastAction({ jobId: job.id, status: 'saved' })
    },
    [jobs, reviewJobMutation],
  )

  const handleSwipeLeft = useCallback(
    async (card: CardData) => {
      await reviewJobMutation({
        jobId: card.id,
        status: 'skipped',
      })
      setLastAction({ jobId: card.id, status: 'skipped' })
    },
    [reviewJobMutation],
  )

  const handleSkipRemaining = useCallback(async () => {
    setIsCompleting(true)
    const unreviewedJobs = jobs.filter(j => !reviewedIdsSet.has(j.id))

    await Promise.all(
      unreviewedJobs.map(job =>
        reviewJobMutation({
          jobId: job.id,
          status: 'skipped',
        }),
      ),
    )

    setTimeout(() => {
      onComplete(savedCount, skippedCount + unreviewedJobs.length)
    }, 300)
  }, [jobs, reviewedIdsSet, reviewJobMutation, savedCount, skippedCount, onComplete])

  const handleDone = useCallback(() => {
    onComplete(savedCount, skippedCount)
  }, [savedCount, skippedCount, onComplete])

  const handleUndo = useCallback(async () => {
    if (!lastAction) return
    await undoMutation({ jobId: lastAction.jobId })
    setLastAction(null)
  }, [lastAction, undoMutation])

  const cards: CardData[] = useMemo(
    () =>
      jobs.map(job => ({
        description: `${job.company}${job.location ? ` · ${job.location}` : ''}`,
        id: job.id,
        title: job.title,
      })),
    [jobs],
  )

  const renderCard = useCallback(
    (card: CardData) => {
      const job = jobs.find(j => j.id === card.id)
      if (!job) return null
      return <JobCardContent job={job} layout='stack' showApplyButton={false} />
    },
    [jobs],
  )

  return (
    <Dialog modal open={open}>
      <DialogContent
        className='max-w-lg w-[95vw] h-[90vh] max-h-[800px] flex flex-col p-0 gap-0'
        onEscapeKeyDown={e => e.preventDefault()}
        onPointerDownOutside={e => e.preventDefault()}
        showCloseButton={false}
      >
        <DialogHeader className='px-4 pt-4 pb-2 border-b shrink-0'>
          <DialogTitle className='text-lg'>Review Jobs</DialogTitle>
          <DialogDescription className='text-sm'>
            Swipe right to save, left to skip
          </DialogDescription>
        </DialogHeader>

        <div className='px-4 py-3 border-b shrink-0'>
          <ProgressBar reviewed={reviewedCount} saved={savedCount} total={jobs.length} />
        </div>

        <div className='flex-1 overflow-hidden flex flex-col items-center justify-center px-4 py-4'>
          {isAllReviewed ? (
            <div className='text-center space-y-6'>
              <div className='space-y-2'>
                <div className='inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 text-green-600 mb-2'>
                  <Check className='h-8 w-8' />
                </div>
                <h3 className='text-xl font-semibold'>All Done!</h3>
                <p className='text-muted-foreground'>You reviewed {jobs.length} jobs</p>
              </div>

              <div className='flex gap-8 justify-center text-sm'>
                <div className='text-center'>
                  <div className='text-2xl font-bold text-green-600'>{savedCount}</div>
                  <div className='text-muted-foreground'>Saved</div>
                </div>
                <div className='text-center'>
                  <div className='text-2xl font-bold text-muted-foreground'>{skippedCount}</div>
                  <div className='text-muted-foreground'>Skipped</div>
                </div>
              </div>

              <Button className='w-full max-w-xs' onClick={handleDone} size='lg'>
                Continue
              </Button>
            </div>
          ) : (
            <MorphingCardStack
              cards={cards}
              className='w-full'
              defaultLayout='stack'
              onSwipeLeft={handleSwipeLeft}
              onSwipeRight={handleSwipeRight}
              removedCardIds={reviewedInThisSearch}
              renderCard={renderCard}
              showLayoutToggle={false}
            />
          )}
        </div>

        {!isAllReviewed && !isCompleting && (lastAction || showSkipButton) && (
          <div className='px-4 py-3 border-t shrink-0 flex gap-2'>
            {lastAction && (
              <Button className='flex-1' onClick={handleUndo} variant='outline'>
                <Undo2 className='h-4 w-4 mr-2' />
                Undo {lastAction.status === 'saved' ? 'save' : 'skip'}
              </Button>
            )}
            {showSkipButton && (
              <Button
                className={
                  lastAction ? 'flex-1 text-muted-foreground' : 'w-full text-muted-foreground'
                }
                onClick={handleSkipRemaining}
                variant='ghost'
              >
                <X className='h-4 w-4 mr-2' />
                Skip remaining {remainingCount}
              </Button>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
