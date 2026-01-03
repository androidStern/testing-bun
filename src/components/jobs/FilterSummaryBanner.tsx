import { convexQuery } from '@convex-dev/react-query'
import { useQuery } from '@tanstack/react-query'
import { Car, Clock, Shield, Zap } from 'lucide-react'
import type { ReactNode } from 'react'
import { api } from '../../../convex/_generated/api'

export type FilterCategory = 'location' | 'fairChance' | 'commute' | 'schedule' | 'quickApply'

interface SummaryPart {
  icon: ReactNode
  text: string
  category: FilterCategory
}

interface FilterSummaryBannerProps {
  onCategoryClick?: (category: FilterCategory) => void
}

export function FilterSummaryBanner({ onCategoryClick }: FilterSummaryBannerProps) {
  const { data: preferences } = useQuery(convexQuery(api.jobPreferences.get, {}))

  const parts = generateFilterSummary(preferences)

  if (parts.length === 0) {
    return (
      <div className='border bg-muted/50 px-4 py-3 text-sm text-muted-foreground'>
        Showing all jobs
      </div>
    )
  }

  return (
    <div className='border bg-muted/50 px-4 py-3'>
      <div className='flex flex-wrap items-center gap-x-2 gap-y-1 text-sm'>
        {parts.map((part, index) => (
          <button
            className='inline-flex items-center gap-1.5 px-2 py-0.5 hover:bg-accent transition-colors'
            key={part.category}
            onClick={() => onCategoryClick?.(part.category)}
            type='button'
          >
            <span className='text-muted-foreground'>{part.icon}</span>
            <span>{part.text}</span>
            {index < parts.length - 1 && <span className='ml-1 text-muted-foreground/50'>•</span>}
          </button>
        ))}
      </div>
    </div>
  )
}

export interface JobPreferences {
  maxCommuteMinutes?: 10 | 30 | 60
  preferEasyApply?: boolean
  preferSecondChance?: boolean
  preferUrgent?: boolean
  requireBusAccessible?: boolean
  requirePublicTransit?: boolean
  requireRailAccessible?: boolean
  requireSecondChance?: boolean
  shiftAfternoon?: boolean
  shiftEvening?: boolean
  shiftFlexible?: boolean
  shiftMorning?: boolean
  shiftOvernight?: boolean
}

function generateFilterSummary(prefs: JobPreferences | null | undefined): Array<SummaryPart> {
  if (!prefs) return []

  const parts: Array<SummaryPart> = []

  // Fair Chance
  if (prefs.requireSecondChance) {
    parts.push({
      category: 'fairChance',
      icon: <Shield className='h-4 w-4' />,
      text: 'Fair chance only',
    })
  } else if (prefs.preferSecondChance) {
    parts.push({
      category: 'fairChance',
      icon: <Shield className='h-4 w-4' />,
      text: 'Fair chance preferred',
    })
  }

  // Commute
  if (prefs.maxCommuteMinutes) {
    const transitParts: Array<string> = []
    if (prefs.requirePublicTransit) {
      if (prefs.requireBusAccessible && prefs.requireRailAccessible) {
        transitParts.push('by bus or rail')
      } else if (prefs.requireBusAccessible) {
        transitParts.push('by bus')
      } else if (prefs.requireRailAccessible) {
        transitParts.push('by rail')
      } else {
        transitParts.push('by transit')
      }
    }
    const transitText = transitParts.length > 0 ? ` ${transitParts.join(' ')}` : ''
    parts.push({
      category: 'commute',
      icon: <Car className='h-4 w-4' />,
      text: `${prefs.maxCommuteMinutes} min${transitText}`,
    })
  } else if (prefs.requirePublicTransit) {
    parts.push({
      category: 'commute',
      icon: <Car className='h-4 w-4' />,
      text: 'Transit accessible',
    })
  }

  // Schedule
  const shifts: Array<string> = []
  if (prefs.shiftMorning) shifts.push('Morning')
  if (prefs.shiftAfternoon) shifts.push('Afternoon')
  if (prefs.shiftEvening) shifts.push('Evening')
  if (prefs.shiftOvernight) shifts.push('Overnight')
  if (prefs.shiftFlexible) shifts.push('Flexible')

  if (shifts.length > 0) {
    const shiftText = shifts.length <= 2 ? shifts.join(' & ') : `${shifts.length} shift types`
    parts.push({
      category: 'schedule',
      icon: <Clock className='h-4 w-4' />,
      text: shiftText,
    })
  }

  // Quick Apply
  const quickParts: Array<string> = []
  if (prefs.preferUrgent) quickParts.push('Urgent')
  if (prefs.preferEasyApply) quickParts.push('Easy apply')

  if (quickParts.length > 0) {
    parts.push({
      category: 'quickApply',
      icon: <Zap className='h-4 w-4' />,
      text: quickParts.join(' & '),
    })
  }

  return parts
}

export { generateFilterSummary }
