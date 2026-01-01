import { convexQuery } from '@convex-dev/react-query'
import { useQuery } from '@tanstack/react-query'
import { Car, Clock, Shield, Zap } from 'lucide-react'


import { api } from '../../../convex/_generated/api'
import { Button } from '../ui/button'
import type { ReactNode } from 'react'
import type { FilterCategory, JobPreferences } from './FilterSummaryBanner'

interface CategoryConfig {
  id: FilterCategory
  label: string
  icon: ReactNode
  hasActiveFilters: (prefs: JobPreferences | null | undefined) => boolean
}

const categories: Array<CategoryConfig> = [
  {
    id: 'fairChance',
    label: 'Fair Chance',
    icon: <Shield className='h-4 w-4' />,
    hasActiveFilters: prefs =>
      Boolean(prefs?.preferSecondChance || prefs?.requireSecondChance),
  },
  {
    id: 'commute',
    label: 'Commute',
    icon: <Car className='h-4 w-4' />,
    hasActiveFilters: prefs =>
      Boolean(
        prefs?.maxCommuteMinutes ||
          prefs?.requirePublicTransit ||
          prefs?.requireBusAccessible ||
          prefs?.requireRailAccessible
      ),
  },
  {
    id: 'schedule',
    label: 'Schedule',
    icon: <Clock className='h-4 w-4' />,
    hasActiveFilters: prefs =>
      Boolean(
        prefs?.shiftMorning ||
          prefs?.shiftAfternoon ||
          prefs?.shiftEvening ||
          prefs?.shiftOvernight ||
          prefs?.shiftFlexible
      ),
  },
  {
    id: 'quickApply',
    label: 'Quick Apply',
    icon: <Zap className='h-4 w-4' />,
    hasActiveFilters: prefs =>
      Boolean(prefs?.preferUrgent || prefs?.preferEasyApply),
  },
]

interface FilterCategoryRowProps {
  onCategoryClick: (category: FilterCategory) => void
  activeCategory?: FilterCategory | null
}

export function FilterCategoryRow({
  onCategoryClick,
  activeCategory,
}: FilterCategoryRowProps) {
  const { data: preferences } = useQuery(convexQuery(api.jobPreferences.get, {}))

  return (
    <div className='flex flex-wrap gap-2'>
      {categories.map(category => {
        const isActive = activeCategory === category.id
        const hasFilters = category.hasActiveFilters(preferences)

        return (
          <Button
            className='relative gap-2'
            key={category.id}
            onClick={() => onCategoryClick(category.id)}
            size='sm'
            variant={isActive ? 'default' : 'outline'}
          >
            {category.icon}
            {category.label}
            {hasFilters && !isActive && (
              <span className='absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-primary' />
            )}
          </Button>
        )
      })}
    </div>
  )
}

export { categories }
