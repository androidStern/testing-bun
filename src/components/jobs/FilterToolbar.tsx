'use client'

import { convexQuery } from '@convex-dev/react-query'
import { useQuery } from '@tanstack/react-query'
import { Car, ChevronDown, Clock, Shield, Zap } from 'lucide-react'
import type { ReactNode } from 'react'

import { api } from '../../../convex/_generated/api'
import { Button } from '../ui/button'
import type { FilterCategory, JobPreferences } from './FilterSummaryBanner'

interface FilterButton {
  category: FilterCategory
  icon: ReactNode
  label: string
  value: string | null
}

interface FilterToolbarProps {
  onCategoryClick: (category: FilterCategory) => void
}

/**
 * FilterToolbar shows all 4 filter categories as buttons.
 * Unlike FilterSummaryBanner, this shows ALL categories (not just those with values set).
 */
export function FilterToolbar({ onCategoryClick }: FilterToolbarProps) {
  const { data: preferences } = useQuery(convexQuery(api.jobPreferences.get, {}))

  const buttons = generateFilterButtons(preferences)

  return (
    <div className="flex flex-wrap items-center gap-2">
      {buttons.map(button => (
        <Button
          key={button.category}
          variant={button.value ? 'secondary' : 'outline'}
          size="sm"
          className="gap-1.5 h-8"
          onClick={() => onCategoryClick(button.category)}
        >
          {button.icon}
          <span className="hidden sm:inline">{button.label}</span>
          {button.value && (
            <span className="text-muted-foreground text-xs hidden md:inline">
              {button.value}
            </span>
          )}
          <ChevronDown className="h-3 w-3 opacity-50" />
        </Button>
      ))}
    </div>
  )
}

function generateFilterButtons(prefs: JobPreferences | null | undefined): FilterButton[] {
  const buttons: FilterButton[] = []

  // Fair Chance
  let fairChanceValue: string | null = null
  if (prefs?.requireSecondChance) {
    fairChanceValue = 'Required'
  } else if (prefs?.preferSecondChance) {
    fairChanceValue = 'Preferred'
  }
  buttons.push({
    category: 'fairChance',
    icon: <Shield className="h-4 w-4" />,
    label: 'Fair Chance',
    value: fairChanceValue,
  })

  // Commute
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
    const transitText = transitParts.length > 0 ? ` by ${transitParts.join('/')}` : ''
    commuteValue = `${prefs.maxCommuteMinutes}min${transitText}`
  } else if (prefs?.requirePublicTransit) {
    commuteValue = 'Transit only'
  }
  buttons.push({
    category: 'commute',
    icon: <Car className="h-4 w-4" />,
    label: 'Commute',
    value: commuteValue,
  })

  // Schedule
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
    icon: <Clock className="h-4 w-4" />,
    label: 'Schedule',
    value: scheduleValue,
  })

  // Quick Apply
  let quickApplyValue: string | null = null
  const quickParts: string[] = []
  if (prefs?.preferUrgent) quickParts.push('Urgent')
  if (prefs?.preferEasyApply) quickParts.push('Easy')
  if (quickParts.length > 0) {
    quickApplyValue = quickParts.join('/')
  }
  buttons.push({
    category: 'quickApply',
    icon: <Zap className="h-4 w-4" />,
    label: 'Quick Apply',
    value: quickApplyValue,
  })

  return buttons
}
