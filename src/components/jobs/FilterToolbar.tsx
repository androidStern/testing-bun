'use client'

import { convexQuery } from '@convex-dev/react-query'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@workos/authkit-tanstack-react-start/client'
import { Car, ChevronDown, Clock, MapPin, Shield, Zap } from 'lucide-react'
import type { ReactNode } from 'react'

import { api } from '../../../convex/_generated/api'
import { Badge } from '../ui/badge'
import { Button } from '../ui/button'
import type { FilterCategory, JobPreferences } from './FilterSummaryBanner'

interface FilterButton {
  category: FilterCategory
  icon: ReactNode
  label: string
  value: string | null
  source?: 'saved' | 'search'
}

interface FilterToolbarProps {
  onCategoryClick: (category: FilterCategory) => void
}

export function FilterToolbar({ onCategoryClick }: FilterToolbarProps) {
  const { user } = useAuth()
  const { data: preferences } = useQuery(convexQuery(api.jobPreferences.get, {}))
  const { data: profile } = useQuery(
    convexQuery(api.profiles.getByWorkosUserId, user?.id ? { workosUserId: user.id } : 'skip'),
  )

  const buttons = generateFilterButtons(preferences, profile)

  return (
    <div className='flex flex-wrap items-center gap-2'>
      {buttons.map(button => (
        <Button
          className='gap-1.5 h-8'
          key={`${button.category}-${button.label}`}
          onClick={() => onCategoryClick(button.category)}
          size='sm'
          variant={button.value ? 'secondary' : 'outline'}
        >
          {button.icon}
          <span className='hidden sm:inline'>{button.label}</span>
          {button.value && (
            <>
              <span className='text-muted-foreground text-xs hidden md:inline'>{button.value}</span>
              {button.source === 'saved' && (
                <Badge className='h-4 px-1 text-[10px] hidden lg:inline-flex' variant='outline'>
                  Saved
                </Badge>
              )}
            </>
          )}
          <ChevronDown className='h-3 w-3 opacity-50' />
        </Button>
      ))}
    </div>
  )
}

interface ProfileData {
  location?: string
  homeLat?: number
  homeLon?: number
  isochrones?: { computedAt: number } | null
}

function generateFilterButtons(
  prefs: JobPreferences | null | undefined,
  profile: ProfileData | null | undefined,
): FilterButton[] {
  const buttons: FilterButton[] = []

  const hasLocation = !!(profile?.homeLat && profile?.homeLon)
  const locationName = profile?.location ?? (hasLocation ? 'Location set' : null)
  const hasTransitZones = !!profile?.isochrones

  buttons.push({
    category: 'location',
    icon: <MapPin className='h-4 w-4' />,
    label: 'Location',
    source: hasLocation ? 'saved' : undefined,
    value: locationName,
  })

  let fairChanceValue: string | null = null
  if (prefs?.requireSecondChance) {
    fairChanceValue = 'Required'
  } else if (prefs?.preferSecondChance) {
    fairChanceValue = 'Preferred'
  }
  buttons.push({
    category: 'fairChance',
    icon: <Shield className='h-4 w-4' />,
    label: 'Fair Chance',
    source: fairChanceValue ? 'saved' : undefined,
    value: fairChanceValue,
  })

  let commuteValue: string | null = null
  if (prefs?.maxCommuteMinutes) {
    const transitParts: string[] = []
    if (prefs.requirePublicTransit) {
      if (prefs.requireBusAccessible && prefs.requireRailAccessible) {
        transitParts.push('bus/rail')
      } else if (prefs.requireBusAccessible) {
        transitParts.push('bus')
      } else if (prefs.requireRailAccessible) {
        transitParts.push('rail')
      } else {
        transitParts.push('transit')
      }
    }
    const transitText = transitParts.length > 0 ? ` ${transitParts.join('/')}` : ''
    commuteValue = `${prefs.maxCommuteMinutes}min${transitText}`
    if (hasTransitZones) {
      commuteValue += ' ✓'
    }
  } else if (prefs?.requirePublicTransit) {
    commuteValue = 'Transit only'
  }
  buttons.push({
    category: 'commute',
    icon: <Car className='h-4 w-4' />,
    label: 'Commute',
    source: commuteValue ? 'saved' : undefined,
    value: commuteValue,
  })

  let scheduleValue: string | null = null
  const shifts: string[] = []
  if (prefs?.shiftMorning) shifts.push('AM')
  if (prefs?.shiftAfternoon) shifts.push('PM')
  if (prefs?.shiftEvening) shifts.push('Eve')
  if (prefs?.shiftOvernight) shifts.push('Night')
  if (prefs?.shiftFlexible) shifts.push('Flex')
  if (shifts.length > 0) {
    scheduleValue = shifts.length <= 2 ? shifts.join('/') : `${shifts.length} shifts`
  }
  buttons.push({
    category: 'schedule',
    icon: <Clock className='h-4 w-4' />,
    label: 'Schedule',
    source: scheduleValue ? 'saved' : undefined,
    value: scheduleValue,
  })

  let quickApplyValue: string | null = null
  const quickParts: string[] = []
  if (prefs?.preferUrgent) quickParts.push('Urgent')
  if (prefs?.preferEasyApply) quickParts.push('Easy')
  if (quickParts.length > 0) {
    quickApplyValue = quickParts.join('/')
  }
  buttons.push({
    category: 'quickApply',
    icon: <Zap className='h-4 w-4' />,
    label: 'Quick Apply',
    source: quickApplyValue ? 'saved' : undefined,
    value: quickApplyValue,
  })

  return buttons
}
