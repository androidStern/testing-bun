'use client'

import { Loader2, Search } from 'lucide-react'
import { useState } from 'react'

import { Button } from '../ui/button'
import { FilterSummaryBanner, type FilterCategory } from '../jobs/FilterSummaryBanner'
import { FilterDrawer } from '../jobs/FilterDrawer'

interface ChatHeaderProps {
  onForceSearch: () => void
  isSearching: boolean
  hasActiveThread: boolean
}

/**
 * ChatHeader displays current preferences and a Force Search button.
 * Clicking preference chips opens the FilterDrawer for editing.
 */
export function ChatHeader({ onForceSearch, isSearching, hasActiveThread }: ChatHeaderProps) {
  const [drawerCategory, setDrawerCategory] = useState<FilterCategory | null>(null)

  const handleCategoryClick = (category: FilterCategory) => {
    setDrawerCategory(category)
  }

  const handleDrawerClose = () => {
    setDrawerCategory(null)
  }

  return (
    <>
      <div className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex items-center justify-between gap-4 p-3">
          {/* Preferences summary - clickable to edit */}
          <div className="flex-1 min-w-0">
            <FilterSummaryBanner onCategoryClick={handleCategoryClick} />
          </div>

          {/* Force Search button */}
          <Button
            onClick={onForceSearch}
            disabled={isSearching}
            size="sm"
            className="flex-shrink-0"
          >
            {isSearching ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Searching...
              </>
            ) : (
              <>
                <Search className="mr-2 h-4 w-4" />
                {hasActiveThread ? 'Search Again' : 'Search Now'}
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Filter Drawer - opens when clicking preference chips */}
      <FilterDrawer category={drawerCategory} onClose={handleDrawerClose} />
    </>
  )
}
