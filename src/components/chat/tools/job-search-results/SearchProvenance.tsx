'use client'

import { Search } from 'lucide-react'

import type { SearchContext } from '@/lib/schemas/job'

const SHIFT_ICONS: Record<string, string> = {
  afternoon: '🌤️',
  evening: '🌙',
  flexible: '⚡',
  morning: '☀️',
  overnight: '🌑',
}

function buildFilterParts(context: SearchContext): string[] {
  const parts: string[] = []

  if (context.location.withinCommuteZone && context.location.maxCommuteMinutes) {
    parts.push(`${context.location.maxCommuteMinutes}min`)
  }

  if (context.filters.busRequired || context.filters.railRequired) {
    parts.push('transit')
  }

  if (context.filters.secondChanceRequired) {
    parts.push('fair chance only')
  } else if (context.filters.secondChancePreferred) {
    parts.push('fair chance')
  }

  if (context.filters.shifts.length > 0) {
    parts.push(context.filters.shifts.join('/'))
  }

  return parts
}

function buildFilterIcons(context: SearchContext): string[] {
  const icons: string[] = []

  if (context.location.withinCommuteZone && context.location.maxCommuteMinutes) {
    icons.push('⏱️')
  }

  if (context.filters.busRequired || context.filters.railRequired) {
    icons.push('🚌')
  }

  if (context.filters.secondChanceRequired || context.filters.secondChancePreferred) {
    icons.push('⭐')
  }

  for (const shift of context.filters.shifts) {
    if (SHIFT_ICONS[shift]) {
      icons.push(SHIFT_ICONS[shift])
    }
  }

  return icons
}

function truncateQuery(query: string, maxLength: number): string {
  if (query.length <= maxLength) return query
  return query.substring(0, maxLength).trim() + '...'
}

interface SearchProvenanceProps {
  jobCount: number
  searchContext: SearchContext
}

export function SearchProvenance({ jobCount, searchContext }: SearchProvenanceProps) {
  const filterParts = buildFilterParts(searchContext)
  const filterIcons = buildFilterIcons(searchContext)
  const filterString = filterParts.length > 0 ? ` · ${filterParts.join(' · ')}` : ''
  const iconString = filterIcons.length > 0 ? ` · ${filterIcons.join(' ')}` : ''

  return (
    <div className='p-3 pb-2 sm:p-4 sm:pb-3'>
      <div className='flex items-center gap-2 text-muted-foreground'>
        <Search className='h-4 w-4' />
        <span className='text-sm'>
          {jobCount === 0 ? 'No jobs found' : `Found ${jobCount} job${jobCount !== 1 ? 's' : ''}`}
        </span>
      </div>

      <p className='mt-1 text-sm text-muted-foreground sm:hidden'>
        "{truncateQuery(searchContext.query, 25)}"{iconString}
      </p>

      <p className='mt-1 hidden text-sm text-muted-foreground sm:block'>
        "{searchContext.query}"{filterString}
      </p>
    </div>
  )
}
