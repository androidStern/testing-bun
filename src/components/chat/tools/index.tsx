'use client'

import { makeAssistantToolUI } from '@assistant-ui/react'
import {
  Briefcase,
  Bus,
  ChevronDown,
  Clock,
  FileText,
  Heart,
  MapPin,
  Search,
  Settings,
  Train,
  Zap,
} from 'lucide-react'
import { useState } from 'react'
import { Plan } from '@/components/tool-ui/plan'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from '@/components/ui/carousel'
import { cn } from '@/lib/utils'
import { JobResultCard } from '../results/JobResultCard'
import { type LocationResult, LocationSetupCard } from './LocationSetupCard'
import { type OptionItem, OptionList } from './OptionList'
import { ToolCard } from './ToolProgress'

// Type definitions for tool arguments and results
interface ResumeResult {
  skills?: string | null
  summary?: string | null
  experience?: Array<{
    title: string
    company: string
    duration?: string
  }>
  education?: Array<{
    institution: string
    degree?: string
  }>
}

interface PreferencesResult {
  maxCommuteMinutes?: number
  requirePublicTransit?: boolean
  preferSecondChance?: boolean
  requireSecondChance?: boolean
  hasHomeLocation?: boolean
  hasTransitZones?: boolean
  shiftPreferences?: {
    morning?: boolean
    afternoon?: boolean
    evening?: boolean
    overnight?: boolean
    flexible?: boolean
  }
  transitRequirements?: {
    bus?: boolean
    rail?: boolean
  }
}

interface SearchJobsArgs {
  query?: string
  filters?: {
    second_chance_only?: boolean
    bus_accessible?: boolean
    rail_accessible?: boolean
    shifts?: Array<string>
    urgent_only?: boolean
    easy_apply_only?: boolean
  }
  limit?: number
}

interface JobResult {
  id: string
  title: string
  company: string
  location: string | null
  description: string | null
  salary: string | null
  isSecondChance: boolean
  secondChanceTier: string | null
  shifts: Array<string>
  transitAccessible: boolean
  busAccessible: boolean
  railAccessible: boolean
  isUrgent: boolean
  isEasyApply: boolean
  url: string
}

interface SearchContext {
  query: string
  totalFound: number
  location: {
    city?: string
    state?: string
    withinCommuteZone: boolean
    maxCommuteMinutes?: number
    homeLocation?: string // User's home location string (e.g., "Miami, FL")
  }
  filters: {
    secondChanceRequired: boolean
    secondChancePreferred: boolean
    busRequired: boolean
    railRequired: boolean
    shifts: Array<string>
    urgentOnly: boolean
    easyApplyOnly: boolean
  }
}

interface SearchResult {
  jobs: Array<JobResult>
  searchContext: SearchContext
}

interface QuestionArgs {
  question: string
  options: Array<{
    id: string
    label: string
    description?: string
  }>
  allowFreeText?: boolean
}

/**
 * Tool UI for getMyResume - shows resume loading/summary
 */
export const ResumeToolUI = makeAssistantToolUI<Record<string, never>, ResumeResult | null>({
  render: ({ result, status }) => {
    const isRunning = status.type === 'running'

    // Running state
    if (isRunning) {
      return (
        <ToolCard
          icon={<FileText className='h-4 w-4' />}
          status='running'
          title='Reading your resume...'
        />
      )
    }

    // No resume found
    if (result === null) {
      return (
        <ToolCard
          detail='Searching with general criteria'
          icon={<FileText className='h-4 w-4' />}
          status='complete'
          title='No resume found'
        />
      )
    }

    // Resume loaded
    const detail = result?.skills
      ? `Skills: ${result.skills.substring(0, 50)}${result.skills.length > 50 ? '...' : ''}`
      : result?.summary
        ? `${result.summary.substring(0, 50)}...`
        : 'Resume loaded'

    return (
      <ToolCard
        detail={detail}
        icon={<FileText className='h-4 w-4' />}
        status='complete'
        title='Resume loaded'
      />
    )
  },
  toolName: 'getMyResume',
})

/**
 * Tool UI for getMyJobPreferences - shows preference summary
 */
export const PreferencesToolUI = makeAssistantToolUI<Record<string, never>, PreferencesResult>({
  render: ({ result, status }) => {
    const isRunning = status.type === 'running'

    if (isRunning) {
      return (
        <ToolCard
          icon={<Settings className='h-4 w-4' />}
          status='running'
          title='Loading your preferences...'
        />
      )
    }

    // Build detail string
    const parts: Array<string> = []
    if (result?.maxCommuteMinutes) {
      parts.push(`${result.maxCommuteMinutes}min commute`)
    }
    if (result?.requireSecondChance) {
      parts.push('Second-chance only')
    } else if (result?.preferSecondChance) {
      parts.push('Prefer second-chance')
    }
    if (result?.hasHomeLocation) {
      parts.push('Location set')
    }
    if (result?.hasTransitZones) {
      parts.push('Transit zones active')
    }

    const detail = parts.length > 0 ? parts.join(' | ') : 'Default preferences'

    return (
      <ToolCard
        detail={detail}
        icon={<Settings className='h-4 w-4' />}
        status='complete'
        title='Preferences loaded'
      />
    )
  },
  toolName: 'getMyJobPreferences',
})

/**
 * Collapsible search details component
 */
function SearchDetailsSection({ context }: { context: SearchContext }) {
  const [isOpen, setIsOpen] = useState(false)

  // Build location display string
  const getLocationDisplay = () => {
    if (context.location.city && context.location.state) {
      return `${context.location.city}, ${context.location.state}`
    }
    if (context.location.withinCommuteZone && context.location.homeLocation) {
      const minutes = context.location.maxCommuteMinutes ?? 30
      return `Within ${minutes} min of ${context.location.homeLocation}`
    }
    if (context.location.homeLocation) {
      return `Near ${context.location.homeLocation}`
    }
    return null
  }

  const locationDisplay = getLocationDisplay()
  const hasFilters =
    locationDisplay ||
    context.filters.busRequired ||
    context.filters.railRequired ||
    context.filters.shifts.length > 0 ||
    context.filters.secondChanceRequired ||
    context.filters.secondChancePreferred ||
    context.filters.urgentOnly ||
    context.filters.easyApplyOnly

  if (!hasFilters) return null

  return (
    <div className='border-t border-border/50'>
      <button
        className='flex w-full items-center justify-between px-4 py-2 text-sm text-muted-foreground hover:bg-muted/30 transition-colors'
        onClick={() => setIsOpen(!isOpen)}
        type='button'
      >
        <span>Search filters</span>
        <ChevronDown
          className={cn('h-4 w-4 transition-transform duration-200', isOpen && 'rotate-180')}
        />
      </button>

      {isOpen && (
        <div className='px-4 pb-3 space-y-2'>
          {/* Location */}
          {locationDisplay && (
            <div className='flex items-center gap-2 text-sm'>
              <MapPin className='h-3.5 w-3.5 text-muted-foreground' />
              <span>{locationDisplay}</span>
            </div>
          )}

          {/* Commute zone indicator */}
          {context.location.withinCommuteZone && (
            <div className='flex items-center gap-2 text-sm'>
              <Clock className='h-3.5 w-3.5 text-muted-foreground' />
              <span>{context.location.maxCommuteMinutes ?? 30} min max commute</span>
            </div>
          )}

          {/* Transit requirements */}
          {(context.filters.busRequired || context.filters.railRequired) && (
            <div className='flex items-center gap-2 text-sm'>
              {context.filters.busRequired && (
                <Badge className='gap-1 text-xs' variant='secondary'>
                  <Bus className='h-3 w-3' />
                  Bus
                </Badge>
              )}
              {context.filters.railRequired && (
                <Badge className='gap-1 text-xs' variant='secondary'>
                  <Train className='h-3 w-3' />
                  Rail
                </Badge>
              )}
            </div>
          )}

          {/* Shifts */}
          {context.filters.shifts.length > 0 && (
            <div className='flex items-center gap-2 text-sm flex-wrap'>
              <Briefcase className='h-3.5 w-3.5 text-muted-foreground' />
              {context.filters.shifts.map(shift => (
                <Badge className='text-xs capitalize' key={shift} variant='outline'>
                  {shift}
                </Badge>
              ))}
            </div>
          )}

          {/* Second chance preference */}
          {(context.filters.secondChanceRequired || context.filters.secondChancePreferred) && (
            <div className='flex items-center gap-2 text-sm'>
              <Heart className='h-3.5 w-3.5 text-muted-foreground' />
              <span>
                {context.filters.secondChanceRequired
                  ? 'Fair Chance employers only'
                  : 'Prefer Fair Chance employers'}
              </span>
            </div>
          )}

          {/* Urgent/Easy apply */}
          {(context.filters.urgentOnly || context.filters.easyApplyOnly) && (
            <div className='flex items-center gap-2 text-sm'>
              <Zap className='h-3.5 w-3.5 text-muted-foreground' />
              {context.filters.urgentOnly && (
                <Badge className='text-xs' variant='secondary'>
                  Urgent hiring
                </Badge>
              )}
              {context.filters.easyApplyOnly && (
                <Badge className='text-xs' variant='secondary'>
                  Easy apply
                </Badge>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/**
 * Tool UI for searchJobs - shows search progress and job cards in a unified card
 */
export const SearchJobsToolUI = makeAssistantToolUI<SearchJobsArgs, SearchResult>({
  render: ({ args, result, status }) => {
    const isRunning = status.type === 'running'
    const query = args?.query ?? '...'

    // Loading state
    if (isRunning) {
      return (
        <ToolCard
          detail={formatFilters(args?.filters)}
          icon={<Search className='h-4 w-4' />}
          status='running'
          title={`Searching: "${query}"`}
        />
      )
    }

    // Handle legacy format (array of jobs) for backwards compatibility
    const jobs = Array.isArray(result) ? result : (result?.jobs ?? [])
    const searchContext = Array.isArray(result) ? null : result?.searchContext

    // No results
    if (jobs.length === 0) {
      return (
        <Card className='mb-4 overflow-hidden'>
          <div className='p-4'>
            <div className='flex items-center gap-2 text-muted-foreground'>
              <Search className='h-4 w-4' />
              <span className='text-sm'>No jobs found</span>
            </div>
            <p className='mt-2 text-lg font-medium'>"{searchContext?.query ?? query}"</p>
          </div>
          {searchContext && <SearchDetailsSection context={searchContext} />}
        </Card>
      )
    }

    // Results card with carousel
    return (
      <Card className='mb-4 overflow-hidden'>
        {/* Header with query and count */}
        <div className='p-4 pb-3'>
          <div className='flex items-start justify-between gap-4'>
            <div className='min-w-0 flex-1'>
              <p className='text-lg font-semibold leading-tight truncate'>
                "{searchContext?.query ?? query}"
              </p>
              <p className='text-sm text-muted-foreground mt-1'>
                Found {jobs.length} job{jobs.length !== 1 ? 's' : ''}
                {searchContext && searchContext.totalFound > jobs.length && (
                  <span className='text-muted-foreground/70'>
                    {' '}
                    (of {searchContext.totalFound} total)
                  </span>
                )}
              </p>
            </div>
            <Search className='h-5 w-5 text-primary flex-shrink-0 mt-1' />
          </div>
        </div>

        {/* Expandable search details */}
        {searchContext && <SearchDetailsSection context={searchContext} />}

        {/* Jobs carousel */}
        <div className='relative px-10 py-4 bg-muted/20'>
          <Carousel className='w-full' opts={{ align: 'start' }}>
            <CarouselContent>
              {jobs.map(job => (
                <CarouselItem
                  className='basis-[280px] sm:basis-[280px] md:basis-[300px]'
                  key={job.id}
                >
                  <JobResultCard
                    className='h-full'
                    job={{
                      company: job.company,
                      id: job.id,
                      isSecondChance: job.isSecondChance,
                      location: job.location,
                      salary: job.salary,
                      shifts: job.shifts,
                      title: job.title,
                      url: job.url,
                    }}
                  />
                </CarouselItem>
              ))}
            </CarouselContent>
            <CarouselPrevious className='left-0 -translate-x-full' />
            <CarouselNext className='right-0 translate-x-full' />
          </Carousel>
        </div>
      </Card>
    )
  },
  toolName: 'searchJobs',
})

/**
 * Tool UI for askQuestion - shows OptionList for Q&A
 */
export const QuestionToolUI = makeAssistantToolUI<QuestionArgs, { selectedOption: string }>({
  render: ({ args, result, status, addResult }) => {
    // Only show confirmed state when user has actually selected an option
    // (tool returns args immediately, but selectedOption only exists after user interaction)
    if (result?.selectedOption) {
      const confirmedOptions =
        args?.options?.filter(
          opt =>
            result.selectedOption === opt.id ||
            (Array.isArray(result.selectedOption) && result.selectedOption.includes(opt.id)),
        ) ?? []

      const confirmed = confirmedOptions.map(o => o.id)

      return (
        <OptionList
          confirmed={confirmed}
          options={args?.options ?? []}
          question={args?.question ?? ''}
        />
      )
    }

    // Interactive state
    return (
      <OptionList
        allowFreeText={args?.allowFreeText ?? true}
        onConfirm={selection => {
          if (selection.length > 0) {
            addResult({ selectedOption: selection[0] })
          }
        }}
        options={args?.options ?? []}
        question={args?.question ?? ''}
      />
    )
  },
  toolName: 'askQuestion',
})

function formatFilters(filters?: SearchJobsArgs['filters']): string | undefined {
  if (!filters) return undefined

  const parts: Array<string> = []
  if (filters.second_chance_only) parts.push('second-chance')
  if (filters.bus_accessible) parts.push('bus')
  if (filters.rail_accessible) parts.push('rail')
  if (filters.shifts?.length) parts.push(`shifts: ${filters.shifts.join(', ')}`)
  if (filters.urgent_only) parts.push('urgent')
  if (filters.easy_apply_only) parts.push('easy apply')

  return parts.length > 0 ? `Filters: ${parts.join(', ')}` : undefined
}

interface ShowPlanArgs {
  id: string
  title: string
  description?: string
  todos: Array<{
    id: string
    label: string
    status: 'pending' | 'in_progress' | 'completed' | 'cancelled'
    description?: string
  }>
}

export const ShowPlanToolUI = makeAssistantToolUI<ShowPlanArgs, ShowPlanArgs>({
  render: ({ args, result, status }) => {
    const plan = result ?? args
    console.log(
      '[MSGDUPE] ShowPlanToolUI RENDER: planId=' +
        (plan?.id ?? 'none') +
        ' title=' +
        (plan?.title ?? 'none') +
        ' todosCount=' +
        (plan?.todos?.length ?? 0) +
        ' status=' +
        JSON.stringify(status),
    )

    if (!plan?.todos) {
      console.log('[MSGDUPE] ShowPlanToolUI returning null - no todos')
      return null
    }

    return (
      <Plan
        description={plan.description}
        id={plan.id}
        showProgress
        title={plan.title}
        todos={plan.todos}
      />
    )
  },
  toolName: 'showPlan',
})

interface CollectLocationArgs {
  reason: string
}

interface CollectLocationResult {
  skipped?: boolean
  location?: {
    lat: number
    lon: number
    city: string
  }
  transportMode?: 'car' | 'transit' | 'flexible'
  maxCommuteMinutes?: 10 | 30 | 60
  hasTransitZones?: boolean
  savedToProfile?: boolean
}

export const CollectLocationToolUI = makeAssistantToolUI<
  CollectLocationArgs,
  CollectLocationResult
>({
  render: ({ args, result, addResult }) => {
    if (result?.skipped) {
      return (
        <ToolCard
          detail='Searching all locations'
          icon={<MapPin className='h-4 w-4' />}
          status='complete'
          title='Location skipped'
        />
      )
    }

    if (result?.location) {
      return (
        <ToolCard
          detail={[
            result.location.city,
            result.transportMode === 'transit' && result.maxCommuteMinutes
              ? `${result.maxCommuteMinutes}min by transit`
              : result.transportMode === 'car'
                ? 'Driving'
                : result.transportMode === 'flexible'
                  ? 'Flexible'
                  : null,
            result.hasTransitZones ? 'Transit zones ready' : null,
          ]
            .filter(Boolean)
            .join(' • ')}
          icon={<MapPin className='h-4 w-4' />}
          status='complete'
          title='Location set'
        />
      )
    }

    return (
      <LocationSetupCard
        onComplete={(locationResult: LocationResult) => addResult(locationResult)}
        reason={args?.reason ?? 'To find jobs near you'}
      />
    )
  },
  toolName: 'collectLocation',
})

export const jobMatcherToolUIs = [
  ResumeToolUI,
  PreferencesToolUI,
  SearchJobsToolUI,
  QuestionToolUI,
  ShowPlanToolUI,
  CollectLocationToolUI,
]
