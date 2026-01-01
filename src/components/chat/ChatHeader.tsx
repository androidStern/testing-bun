'use client'

import { Loader2, RefreshCw, RotateCcw, Search } from 'lucide-react'
import { useState } from 'react'

import { Button } from '../ui/button'
import { FilterToolbar } from '../jobs/FilterToolbar'
import { FilterDrawer } from '../jobs/FilterDrawer'
import type { FilterCategory } from '../jobs/FilterSummaryBanner'

interface ChatHeaderProps {
  onForceSearch: () => void
  onNewChat?: () => void
  onRedoSearch?: () => void
  isSearching: boolean
  hasActiveThread: boolean
  filtersChanged?: boolean
}

/**
 * ChatHeader with filter toolbar and action buttons.
 * Shows all 4 filter categories as buttons, plus Start New, Redo Search, and Search Now.
 */
export function ChatHeader({
  onForceSearch,
  onNewChat,
  onRedoSearch,
  isSearching,
  hasActiveThread,
  filtersChanged = false,
}: ChatHeaderProps) {
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
        {/* Responsive layout: mobile = buttons top, filters bottom; desktop = filters left, buttons right */}
        <div className="flex flex-col-reverse md:flex-row md:items-center md:justify-between gap-2 p-3">
          {/* Filters - bottom on mobile, left on desktop */}
          <FilterToolbar onCategoryClick={handleCategoryClick} />

          {/* Action buttons - top on mobile, right on desktop */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {/* Start New - only when there's an active thread */}
            {hasActiveThread && onNewChat && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onNewChat}
                disabled={isSearching}
              >
                <RotateCcw className="mr-2 h-4 w-4" />
                Start New
              </Button>
            )}

            {/* Redo Search - only when filters changed since last search */}
            {hasActiveThread && filtersChanged && onRedoSearch && (
              <Button
                variant="outline"
                size="sm"
                onClick={onRedoSearch}
                disabled={isSearching}
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                Redo Search
              </Button>
            )}

            {/* Primary search button */}
            <Button
              onClick={onForceSearch}
              disabled={isSearching}
              size="sm"
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
      </div>

      {/* Filter Drawer - opens when clicking filter buttons */}
      <FilterDrawer category={drawerCategory} onClose={handleDrawerClose} />
    </>
  )
}
