'use client'

import { makeAssistantToolUI } from '@assistant-ui/react'
import { useAuth } from '@workos/authkit-tanstack-react-start/client'
import { FileText, MapPin, Search, Settings } from 'lucide-react'

import { ResumeUploadCard, type ResumeUploadResult } from '@/components/resume/ResumeUploadCard'
import type { SearchContext, SearchJobResult } from '@/lib/schemas/job'
import { JobSearchResults } from './job-search-results'
import { JobCardStack } from './job-search-results/JobCardStack'
import { type LocationResult, LocationSetupCard } from './LocationSetupCard'
import { OptionList } from './OptionList'
import { PreferenceToolUI } from './PreferenceToolUI'
import { ToolCard } from './ToolProgress'

export { PreferenceToolUI }

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

interface SearchResult {
  jobs: Array<SearchJobResult>
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
  purpose?: 'discovery' | 'post_search' | 'application' | 'other'
  preamble?: string
}

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

export const SearchJobsToolUI = makeAssistantToolUI<SearchJobsArgs, SearchResult>({
  render: function SearchJobsRender({ args, result, status }) {
    const { user } = useAuth()
    const isRunning = status.type === 'running'
    const query = args?.query ?? '...'

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

    const jobs = Array.isArray(result) ? result : (result?.jobs ?? [])
    const searchContext = Array.isArray(result)
      ? createDefaultSearchContext(query)
      : (result?.searchContext ?? createDefaultSearchContext(query))

    if (user?.id) {
      return <JobCardStack jobs={jobs} searchContext={searchContext} workosUserId={user.id} />
    }

    return <JobSearchResults jobs={jobs} searchContext={searchContext} />
  },
  toolName: 'searchJobs',
})

function createDefaultSearchContext(query: string): SearchContext {
  return {
    filters: {
      busRequired: false,
      easyApplyOnly: false,
      railRequired: false,
      secondChancePreferred: false,
      secondChanceRequired: false,
      shifts: [],
      urgentOnly: false,
    },
    location: { withinCommuteZone: false },
    query,
    totalFound: 0,
  }
}

export const QuestionToolUI = makeAssistantToolUI<QuestionArgs, { selectedOption: string }>({
  render: ({ args, result, addResult }) => {
    const preamble = args?.preamble

    if (result?.selectedOption) {
      const confirmedOptions =
        args?.options?.filter(
          opt =>
            result.selectedOption === opt.id ||
            (Array.isArray(result.selectedOption) && result.selectedOption.includes(opt.id)),
        ) ?? []

      const confirmed = confirmedOptions.map(o => o.id)

      return (
        <div>
          {preamble && (
            <p className='text-sm text-muted-foreground mb-3 leading-relaxed'>{preamble}</p>
          )}
          <OptionList
            confirmed={confirmed}
            options={args?.options ?? []}
            question={args?.question ?? ''}
          />
        </div>
      )
    }

    return (
      <div>
        {preamble && (
          <p className='text-sm text-muted-foreground mb-3 leading-relaxed'>{preamble}</p>
        )}
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
      </div>
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

interface CollectResumeArgs {
  reason: string
}

interface CollectResumeResult {
  uploaded?: boolean
  skipped?: boolean
}

export const CollectResumeToolUI = makeAssistantToolUI<CollectResumeArgs, CollectResumeResult>({
  render: ({ args, result, addResult }) => {
    if (result?.skipped) {
      return (
        <ToolCard
          detail='Continuing without resume'
          icon={<FileText className='h-4 w-4' />}
          status='complete'
          title='Resume skipped'
        />
      )
    }

    if (result?.uploaded) {
      return (
        <ToolCard
          detail='Ready for better job matches'
          icon={<FileText className='h-4 w-4' />}
          status='complete'
          title='Resume uploaded'
        />
      )
    }

    return (
      <ResumeUploadCard
        onComplete={(uploadResult: ResumeUploadResult) =>
          addResult({ skipped: !uploadResult.uploaded, uploaded: uploadResult.uploaded })
        }
        onSkip={() => addResult({ skipped: true })}
        reason={args?.reason}
      />
    )
  },
  toolName: 'collectResume',
})

export const jobMatcherToolUIs = [
  ResumeToolUI,
  PreferencesToolUI,
  SearchJobsToolUI,
  QuestionToolUI,
  CollectLocationToolUI,
  CollectResumeToolUI,
  PreferenceToolUI,
]
