'use client'

import { Clock, DollarSign, ExternalLink, MapPin, Star } from 'lucide-react'

import { Badge } from '../../ui/badge'
import { Button } from '../../ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../ui/card'
import { cn } from '../../../lib/utils'

export interface JobMatch {
  id: string
  title: string
  company: string
  location: string | null
  matchReason?: string
  highlights?: Array<string>
  salary: string | null
  isSecondChance: boolean
  shifts: Array<string>
  url: string
}

interface JobResultCardProps {
  job: JobMatch
  compact?: boolean
  className?: string
}

/**
 * JobResultCard displays a single job match inline in the chat.
 * Supports both full and compact display modes.
 */
export function JobResultCard({ job, compact = false, className }: JobResultCardProps) {
  if (compact) {
    return (
      <div
        className={cn(
          'flex items-center justify-between gap-3 border bg-card p-3',
          className
        )}
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="font-medium truncate">{job.title}</span>
            {job.isSecondChance && (
              <Badge variant="secondary" className="bg-green-100 text-green-800 flex-shrink-0">
                <Star className="h-3 w-3 mr-1" />
                Fair Chance
              </Badge>
            )}
          </div>
          <div className="text-sm text-muted-foreground truncate">
            {job.company}
            {job.location && ` • ${job.location}`}
          </div>
        </div>
        <Button size="sm" variant="outline" asChild className="flex-shrink-0">
          <a href={job.url} target="_blank" rel="noopener noreferrer">
            Apply
            <ExternalLink className="ml-1 h-3 w-3" />
          </a>
        </Button>
      </div>
    )
  }

  return (
    <Card className={cn('hover:shadow-md transition-shadow h-full flex flex-col', className)}>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <CardTitle className="text-lg truncate">{job.title}</CardTitle>
            <CardDescription className="text-base font-medium">{job.company}</CardDescription>
          </div>
          {job.isSecondChance && (
            <Badge variant="secondary" className="bg-green-100 text-green-800 flex-shrink-0">
              <Star className="h-3 w-3 mr-1" />
              Fair Chance
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3 flex-1 flex flex-col">
        {/* Location & Salary */}
        <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
          {job.location && (
            <span className="flex items-center gap-1">
              <MapPin className="h-4 w-4" />
              {job.location}
            </span>
          )}
          {job.salary && (
            <span className="flex items-center gap-1">
              <DollarSign className="h-4 w-4" />
              {job.salary}
            </span>
          )}
        </div>

        {/* Shifts */}
        {job.shifts.length > 0 && (
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <div className="flex flex-wrap gap-1">
              {job.shifts.map(shift => (
                <Badge key={shift} variant="outline" className="text-xs capitalize">
                  {shift}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Match Reason */}
        {job.matchReason && (
          <div className="bg-muted/50 p-3">
            <p className="text-sm font-medium mb-1">Why this matches:</p>
            <p className="text-sm text-muted-foreground">{job.matchReason}</p>
          </div>
        )}

        {/* Highlights */}
        {job.highlights && job.highlights.length > 0 && (
          <ul className="text-sm space-y-1">
            {job.highlights.slice(0, 3).map(highlight => (
              <li key={highlight} className="flex items-start gap-2">
                <span className="text-primary">•</span>
                {highlight}
              </li>
            ))}
          </ul>
        )}

        {/* Apply Button - pushed to bottom with mt-auto */}
        <Button asChild className="w-full mt-auto">
          <a href={job.url} target="_blank" rel="noopener noreferrer">
            Apply Now
            <ExternalLink className="ml-2 h-4 w-4" />
          </a>
        </Button>
      </CardContent>
    </Card>
  )
}

interface JobResultsListProps {
  jobs: Array<JobMatch>
  summary?: string
  suggestions?: Array<string>
  compact?: boolean
  className?: string
}

/**
 * JobResultsList displays multiple job results with optional summary and suggestions.
 */
export function JobResultsList({
  jobs,
  summary,
  suggestions,
  compact = false,
  className,
}: JobResultsListProps) {
  if (jobs.length === 0) {
    return (
      <div className={cn('border bg-muted/30 p-4 text-center', className)}>
        <p className="text-muted-foreground">No matching jobs found.</p>
        {suggestions && suggestions.length > 0 && (
          <div className="mt-3">
            <p className="text-sm font-medium mb-2">Try:</p>
            <ul className="text-sm text-muted-foreground space-y-1">
              {suggestions.map(suggestion => (
                <li key={suggestion}>• {suggestion}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className={cn('space-y-4', className)}>
      {/* Summary */}
      {summary && (
        <div className="border bg-card p-4">
          <p className="text-sm">{summary}</p>
        </div>
      )}

      {/* Job Cards */}
      <div className={cn(compact ? 'space-y-2' : 'grid gap-4')}>
        {jobs.map(job => (
          <JobResultCard key={job.id} job={job} compact={compact} />
        ))}
      </div>

      {/* Suggestions */}
      {suggestions && suggestions.length > 0 && (
        <div className="border bg-muted/30 p-4">
          <p className="text-sm font-medium mb-2">Suggestions to improve results:</p>
          <ul className="text-sm text-muted-foreground space-y-1">
            {suggestions.map(suggestion => (
              <li key={suggestion}>• {suggestion}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
