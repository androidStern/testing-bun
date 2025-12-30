import { createFileRoute } from '@tanstack/react-router'
import { getAuth } from '@workos/authkit-tanstack-react-start'
import { useState } from 'react'

import { JobMatcher } from '../../components/JobMatcher'
import {
  FilterCategoryRow,
  FilterDrawer,
  FilterSummaryBanner,
  type FilterCategory,
} from '../../components/jobs'
import { Toaster } from '../../components/ui/toaster'

export const Route = createFileRoute('/_authenticated/jobs')({
  component: JobsPage,
  loader: async () => {
    const auth = await getAuth()

    if (!auth.user) {
      throw new Error('Not authenticated')
    }

    return {
      user: auth.user,
    }
  },
})

function JobsPage() {
  const { user } = Route.useLoaderData()
  const [activeCategory, setActiveCategory] = useState<FilterCategory | null>(null)

  const handleCategoryClick = (category: FilterCategory) => {
    setActiveCategory(category)
  }

  const handleDrawerClose = () => {
    setActiveCategory(null)
  }

  return (
    <div className='min-h-screen bg-background'>
      <div className='container mx-auto max-w-4xl py-8 px-4'>
        <h1 className='text-3xl font-bold mb-6'>Find Jobs</h1>

        {/* Filter Summary - Always visible */}
        <div className='space-y-4 mb-6'>
          <FilterSummaryBanner onCategoryClick={handleCategoryClick} />
          <FilterCategoryRow
            activeCategory={activeCategory}
            onCategoryClick={handleCategoryClick}
          />
        </div>

        {/* AI Job Matcher - Main feature */}
        <JobMatcher workosUserId={user.id} />

        {/* Filter Drawer */}
        <FilterDrawer category={activeCategory} onClose={handleDrawerClose} />
      </div>
      <Toaster />
    </div>
  )
}
