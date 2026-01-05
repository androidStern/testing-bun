'use client'

import { convexQuery } from '@convex-dev/react-query'
import { useQuery as useTanstackQuery } from '@tanstack/react-query'
import { useMutation } from 'convex/react'
import { useCallback, useEffect, useMemo, useState } from 'react'

import {
  type CardData,
  type LayoutMode,
  MorphingCardStack,
} from '@/components/ui/morphing-card-stack'
import type { SearchContext, SearchJobResult } from '@/lib/schemas/job'
import { api } from '../../../../../convex/_generated/api'

import { JobCardContent } from './JobCardContent'
import { ProgressBar } from './ProgressBar'
import { SearchProvenance } from './SearchProvenance'

const MOBILE_BREAKPOINT = 768

interface JobCardStackProps {
  jobs: Array<SearchJobResult>
  searchContext: SearchContext
  workosUserId: string
}

export function JobCardStack({ jobs, searchContext, workosUserId }: JobCardStackProps) {
  const [reviewedIds, setReviewedIds] = useState<Set<string>>(new Set())
  const [localSavedIds, setLocalSavedIds] = useState<Set<string>>(new Set())
  const [layout, setLayout] = useState<LayoutMode>('stack')

  const saveJobMutation = useMutation(api.savedJobs.saveJob)

  const { data: savedJobIds = [] } = useTanstackQuery(
    convexQuery(api.savedJobs.getSavedJobIds, { workosUserId }),
  )

  const savedIdsSet = useMemo(
    () => new Set([...savedJobIds, ...localSavedIds]),
    [savedJobIds, localSavedIds],
  )

  useEffect(() => {
    const handleResize = () => {
      const isMobile = window.innerWidth < MOBILE_BREAKPOINT
      setLayout(prev => {
        if (prev === 'stack' && !isMobile) return 'list'
        if (prev === 'list' && isMobile) return 'stack'
        return prev
      })
    }

    handleResize()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const handleSwipeRight = useCallback(
    async (card: CardData) => {
      const job = jobs.find(j => j.id === card.id)
      if (!job) return

      setReviewedIds(prev => new Set([...prev, card.id]))
      setLocalSavedIds(prev => new Set([...prev, card.id]))

      try {
        await saveJobMutation({
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
          workosUserId,
        })
      } catch (error) {
        console.error('Failed to save job:', error)
        setLocalSavedIds(prev => {
          const next = new Set(prev)
          next.delete(card.id)
          return next
        })
      }
    },
    [jobs, saveJobMutation, workosUserId],
  )

  const handleSwipeLeft = useCallback((card: CardData) => {
    setReviewedIds(prev => new Set([...prev, card.id]))
  }, [])

  const handleLayoutChange = useCallback((newLayout: LayoutMode) => {
    setLayout(newLayout)
  }, [])

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
    (card: CardData, cardLayout: LayoutMode) => {
      const job = jobs.find(j => j.id === card.id)
      if (!job) return null
      return (
        <JobCardContent job={job} layout={cardLayout} showApplyButton={cardLayout !== 'stack'} />
      )
    },
    [jobs],
  )

  const reviewedCount = reviewedIds.size
  const savedCount = savedIdsSet.size
  const totalCount = jobs.length

  if (jobs.length === 0) {
    return (
      <div className='mb-4 overflow-hidden rounded-lg border border-border'>
        <SearchProvenance jobCount={0} searchContext={searchContext} />
      </div>
    )
  }

  return (
    <div className='space-y-4'>
      <div className='rounded-lg border border-border overflow-hidden'>
        <SearchProvenance jobCount={jobs.length} searchContext={searchContext} />
      </div>

      <ProgressBar reviewed={reviewedCount} saved={savedCount} total={totalCount} />

      <MorphingCardStack
        cards={cards}
        defaultLayout={layout}
        onLayoutChange={handleLayoutChange}
        onSwipeLeft={handleSwipeLeft}
        onSwipeRight={handleSwipeRight}
        removedCardIds={layout === 'stack' ? reviewedIds : new Set()}
        renderCard={renderCard}
        showLayoutToggle={true}
      />

      {layout === 'stack' && reviewedIds.size === jobs.length && (
        <div className='text-center py-8 text-muted-foreground'>
          <p className='text-lg font-medium'>All done!</p>
          <p className='text-sm'>
            You've reviewed all {jobs.length} jobs. {savedCount} saved.
          </p>
        </div>
      )}
    </div>
  )
}
