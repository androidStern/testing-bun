'use client'

import { convexQuery } from '@convex-dev/react-query'
import { useQuery as useTanstackQuery } from '@tanstack/react-query'
import { useCallback, useMemo, useState } from 'react'

import type { SearchContext, SearchJobResult } from '@/lib/schemas/job'
import { api } from '../../../../../convex/_generated/api'

import { JobReviewModal } from './JobReviewModal'
import { SearchProvenance } from './SearchProvenance'

interface JobCardStackProps {
  jobs: Array<SearchJobResult>
  searchContext: SearchContext
}

export function JobCardStack({ jobs, searchContext }: JobCardStackProps) {
  const [modalOpen, setModalOpen] = useState(true)
  const [reviewSummary, setReviewSummary] = useState<{
    savedCount: number
    skippedCount: number
  } | null>(null)

  const { data: reviewedJobIds = [] } = useTanstackQuery(
    convexQuery(api.jobReviews.getReviewedJobIds, {}),
  )

  const reviewedIdsSet = useMemo(() => new Set(reviewedJobIds), [reviewedJobIds])

  const allJobsAlreadyReviewed = useMemo(
    () => jobs.length > 0 && jobs.every(j => reviewedIdsSet.has(j.id)),
    [jobs, reviewedIdsSet],
  )

  const shouldShowModal = modalOpen && !allJobsAlreadyReviewed

  const handleComplete = useCallback((savedCount: number, skippedCount: number) => {
    setReviewSummary({ savedCount, skippedCount })
    setModalOpen(false)
  }, [])

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

      {(reviewSummary || allJobsAlreadyReviewed) && (
        <div className='rounded-lg border border-border bg-muted/30 p-4 text-center'>
          <p className='text-sm text-muted-foreground'>
            {allJobsAlreadyReviewed && !reviewSummary ? (
              <>All {jobs.length} jobs already reviewed</>
            ) : (
              <>
                Reviewed {jobs.length} jobs •{' '}
                <span className='text-green-600 font-medium'>
                  {reviewSummary?.savedCount ?? 0} saved
                </span>
                {(reviewSummary?.skippedCount ?? 0) > 0 && (
                  <>
                    {' '}
                    •{' '}
                    <span className='text-muted-foreground'>
                      {reviewSummary?.skippedCount} skipped
                    </span>
                  </>
                )}
              </>
            )}
          </p>
          <p className='text-xs text-muted-foreground mt-1'>
            Saved jobs appear in the heart icon above
          </p>
        </div>
      )}

      <JobReviewModal jobs={jobs} onComplete={handleComplete} open={shouldShowModal} />
    </div>
  )
}
