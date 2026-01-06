'use client'

import { Bug, Loader2, RefreshCw, RotateCcw, Search } from 'lucide-react'
import { useState } from 'react'
import { FilterDrawer } from '../jobs/FilterDrawer'
import type { FilterCategory } from '../jobs/FilterSummaryBanner'
import { FilterToolbar } from '../jobs/FilterToolbar'
import { ThemeToggle } from '../ThemeToggle'
import { Button } from '../ui/button'
import { SavedJobsDrawer } from './SavedJobsDrawer'
import { SavedJobsToggle } from './SavedJobsToggle'

interface ChatHeaderProps {
  onForceSearch: () => void
  onNewChat?: () => void
  onRedoSearch?: () => void
  isSearching: boolean
  hasActiveThread: boolean
  filtersChanged?: boolean
  isAuthenticated?: boolean
  isAdmin?: boolean
  onDebugClick?: () => void
}

export function ChatHeader({
  onForceSearch,
  onNewChat,
  onRedoSearch,
  isSearching,
  hasActiveThread,
  filtersChanged = false,
  isAuthenticated = false,
  isAdmin = false,
  onDebugClick,
}: ChatHeaderProps) {
  const [drawerCategory, setDrawerCategory] = useState<FilterCategory | null>(null)
  const [savedJobsOpen, setSavedJobsOpen] = useState(false)

  const handleCategoryClick = (category: FilterCategory) => {
    setDrawerCategory(category)
  }

  const handleDrawerClose = () => {
    setDrawerCategory(null)
  }

  return (
    <>
      <div className='sticky top-0 z-10 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60'>
        <div className='flex flex-col-reverse md:flex-row md:items-center md:justify-between gap-2 p-3'>
          <FilterToolbar onCategoryClick={handleCategoryClick} />

          <div className='flex items-center justify-between md:justify-end gap-2 flex-shrink-0'>
            <ThemeToggle />

            {isAdmin && onDebugClick && (
              <Button onClick={onDebugClick} size='sm' variant='ghost'>
                <Bug className='h-4 w-4' />
              </Button>
            )}

            {isAuthenticated && <SavedJobsToggle onClick={() => setSavedJobsOpen(true)} />}

            {hasActiveThread && onNewChat && (
              <Button disabled={isSearching} onClick={onNewChat} size='sm' variant='ghost'>
                <RotateCcw className='mr-2 h-4 w-4' />
                Start New
              </Button>
            )}

            {hasActiveThread && filtersChanged && onRedoSearch && (
              <Button disabled={isSearching} onClick={onRedoSearch} size='sm' variant='outline'>
                <RefreshCw className='mr-2 h-4 w-4' />
                Redo Search
              </Button>
            )}

            <Button disabled={isSearching} onClick={onForceSearch} size='sm'>
              {isSearching ? (
                <>
                  <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                  Searching...
                </>
              ) : (
                <>
                  <Search className='mr-2 h-4 w-4' />
                  {hasActiveThread ? 'Search Again' : 'Search Now'}
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      <FilterDrawer category={drawerCategory} onClose={handleDrawerClose} />

      {isAuthenticated && <SavedJobsDrawer onOpenChange={setSavedJobsOpen} open={savedJobsOpen} />}
    </>
  )
}
