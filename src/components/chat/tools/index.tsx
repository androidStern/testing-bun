'use client'

import { makeAssistantToolUI } from '@assistant-ui/react'
import { FileText, Search, Settings, HelpCircle } from 'lucide-react'

import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from '@/components/ui/carousel'
import { ToolCard } from './ToolProgress'
import { OptionList, type OptionItem } from './OptionList'
import { JobResultCard } from '../results/JobResultCard'

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
  toolName: 'getMyResume',
  render: ({ result, status }) => {
    const isRunning = status.type === 'running'

    // Running state
    if (isRunning) {
      return (
        <ToolCard
          icon={<FileText className="h-4 w-4" />}
          title="Reading your resume..."
          status="running"
        />
      )
    }

    // No resume found
    if (result === null) {
      return (
        <ToolCard
          icon={<FileText className="h-4 w-4" />}
          title="No resume found"
          status="complete"
          detail="Searching with general criteria"
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
        icon={<FileText className="h-4 w-4" />}
        title="Resume loaded"
        status="complete"
        detail={detail}
      />
    )
  },
})

/**
 * Tool UI for getMyJobPreferences - shows preference summary
 */
export const PreferencesToolUI = makeAssistantToolUI<Record<string, never>, PreferencesResult>({
  toolName: 'getMyJobPreferences',
  render: ({ result, status }) => {
    const isRunning = status.type === 'running'

    if (isRunning) {
      return (
        <ToolCard
          icon={<Settings className="h-4 w-4" />}
          title="Loading your preferences..."
          status="running"
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
        icon={<Settings className="h-4 w-4" />}
        title="Preferences loaded"
        status="complete"
        detail={detail}
      />
    )
  },
})

/**
 * Tool UI for searchJobs - shows search progress and job cards
 */
export const SearchJobsToolUI = makeAssistantToolUI<SearchJobsArgs, Array<JobResult>>({
  toolName: 'searchJobs',
  render: ({ args, result, status }) => {
    const isRunning = status.type === 'running'
    const query = args?.query ?? '...'

    if (isRunning) {
      return (
        <ToolCard
          icon={<Search className="h-4 w-4" />}
          title={`Searching: "${query}"`}
          status="running"
          detail={formatFilters(args?.filters)}
        />
      )
    }

    const jobs = result ?? []

    // No results
    if (jobs.length === 0) {
      return (
        <ToolCard
          icon={<Search className="h-4 w-4" />}
          title="No jobs found"
          status="complete"
          detail={`Query: "${query}"`}
        />
      )
    }

    // Render job cards in a carousel
    return (
      <div className="space-y-3 w-full">
        <ToolCard
          icon={<Search className="h-4 w-4" />}
          title={`Found ${jobs.length} jobs`}
          status="complete"
          detail={`Query: "${query}"`}
        />
        {/* Carousel with padding for nav buttons */}
        <div className="relative px-10">
          <Carousel opts={{ align: 'start' }} className="w-full">
            <CarouselContent>
              {jobs.map(job => (
                <CarouselItem
                  key={job.id}
                  className="basis-[280px] sm:basis-[280px] md:basis-[300px]"
                >
                  <JobResultCard
                    className="h-full"
                    job={{
                      id: job.id,
                      title: job.title,
                      company: job.company,
                      location: job.location,
                      salary: job.salary,
                      isSecondChance: job.isSecondChance,
                      shifts: job.shifts,
                      url: job.url,
                    }}
                  />
                </CarouselItem>
              ))}
            </CarouselContent>
            <CarouselPrevious className="left-0 -translate-x-full" />
            <CarouselNext className="right-0 translate-x-full" />
          </Carousel>
        </div>
      </div>
    )
  },
})

/**
 * Tool UI for askQuestion - shows OptionList for Q&A
 */
export const QuestionToolUI = makeAssistantToolUI<QuestionArgs, { selectedOption: string }>({
  toolName: 'askQuestion',
  render: ({ args, result, status, addResult }) => {
    // If we have a result, show confirmed state
    if (result) {
      const confirmedOptions = args?.options?.filter(opt =>
        result.selectedOption === opt.id ||
        (Array.isArray(result.selectedOption) && result.selectedOption.includes(opt.id))
      ) ?? []

      const confirmed = confirmedOptions.map(o => o.id)

      return (
        <OptionList
          question={args?.question ?? ''}
          options={args?.options ?? []}
          confirmed={confirmed}
        />
      )
    }

    // Interactive state
    return (
      <OptionList
        question={args?.question ?? ''}
        options={args?.options ?? []}
        allowFreeText={args?.allowFreeText ?? true}
        onConfirm={(selection) => {
          if (selection.length > 0) {
            addResult({ selectedOption: selection[0] })
          }
        }}
      />
    )
  },
})

// Helper function to format filters for display
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

/**
 * Export all tool UIs as an array for easy registration
 */
export const jobMatcherToolUIs = [
  ResumeToolUI,
  PreferencesToolUI,
  SearchJobsToolUI,
  QuestionToolUI,
]
