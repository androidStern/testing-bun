'use client'

import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import type { SearchContext, SearchJobResult } from '@/lib/schemas/job'

import { JobRow } from './JobRow'
import { SearchProvenance } from './SearchProvenance'

const DEFAULT_VISIBLE_COUNT = 5

interface JobSearchResultsProps {
  jobs: Array<SearchJobResult>
  searchContext: SearchContext
}

export function JobSearchResults({ jobs, searchContext }: JobSearchResultsProps) {
  const [expandedJobId, setExpandedJobId] = useState<string | null>(null)
  const [visibleCount, setVisibleCount] = useState(DEFAULT_VISIBLE_COUNT)

  const visibleJobs = jobs.slice(0, visibleCount)
  const remainingCount = jobs.length - visibleCount

  const handleToggle = (jobId: string) => {
    setExpandedJobId(expandedJobId === jobId ? null : jobId)
  }

  const handleShowMore = () => {
    setVisibleCount(jobs.length)
  }

  if (jobs.length === 0) {
    return (
      <Card className='mb-4 overflow-hidden'>
        <SearchProvenance jobCount={0} searchContext={searchContext} />
      </Card>
    )
  }

  return (
    <Card className='mb-4 overflow-hidden'>
      <SearchProvenance jobCount={jobs.length} searchContext={searchContext} />

      <div className='border-t border-border/50'>
        {visibleJobs.map(job => (
          <JobRow
            isExpanded={expandedJobId === job.id}
            job={job}
            key={job.id}
            onToggle={() => handleToggle(job.id)}
          />
        ))}
      </div>

      {remainingCount > 0 && (
        <div className='flex justify-center border-t border-border/50 p-3'>
          <Button onClick={handleShowMore} size='sm' variant='ghost'>
            Show {remainingCount} more
          </Button>
        </div>
      )}
    </Card>
  )
}

export { JobRow } from './JobRow'
export { SearchProvenance } from './SearchProvenance'
