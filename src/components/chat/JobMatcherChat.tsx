'use client'

import { ComposerPrimitive } from '@assistant-ui/react'
import { convexQuery } from '@convex-dev/react-query'
import { useQuery } from '@tanstack/react-query'
import { useAction } from 'convex/react'
import { Loader2, MessageSquare, Send } from 'lucide-react'
import { useCallback, useMemo, useState } from 'react'

import { Thread } from '@/components/assistant-ui/thread'
import { api } from '../../../convex/_generated/api'
import type { JobPreferences } from '../jobs/FilterSummaryBanner'
import { Button } from '../ui/button'
import { ChatHeader } from './ChatHeader'
import { JobMatcherRuntimeProvider } from './JobMatcherRuntimeProvider'
import { PlanHeader } from './PlanHeader'
import {
  CollectLocationToolUI,
  PreferencesToolUI,
  QuestionToolUI,
  ResumeToolUI,
  SearchJobsToolUI,
} from './tools'

/**
 * JobMatcherChat - Main chat interface for the job matcher.
 *
 * Features:
 * - Header with preference controls and Force Search button
 * - Chat messages with tool activity visualization
 * - Quick-reply buttons for Q&A
 * - Inline job results
 * - Persistent chat history via Convex Agent
 */
export function JobMatcherChat() {
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null)
  const [lastSearchPrefs, setLastSearchPrefs] = useState<JobPreferences | null>(null)

  // Check for existing active search
  const {
    data: activeSearch,
    isLoading: searchLoading,
    refetch: refetchSearch,
  } = useQuery(convexQuery(api.jobMatcher.queries.getActiveSearch, {}))

  // Get current preferences for filter change detection
  const { data: currentPrefs } = useQuery(convexQuery(api.jobPreferences.get, {}))

  // Detect if filters have changed since last search
  const filtersChanged = useMemo(() => {
    if (!lastSearchPrefs || !currentPrefs) return false
    return JSON.stringify(lastSearchPrefs) !== JSON.stringify(currentPrefs)
  }, [lastSearchPrefs, currentPrefs])

  // Use active search's thread ID if available
  const threadId = activeThreadId ?? activeSearch?.threadId ?? null

  // Actions
  const forceSearchAction = useAction(api.jobMatcher.actions.forceSearch)
  const cancelSearchAction = useAction(api.jobMatcher.actions.cancelSearch)

  // Track if we're in the middle of a force search
  const [isForceSearching, setIsForceSearching] = useState(false)

  const handleForceSearch = useCallback(async () => {
    setIsForceSearching(true)
    try {
      // Snapshot current preferences before search
      if (currentPrefs) {
        setLastSearchPrefs(currentPrefs)
      }
      const result = await forceSearchAction({ threadId: threadId ?? undefined })
      if (result.isNew) {
        setActiveThreadId(result.threadId)
        await refetchSearch()
      }
    } finally {
      setIsForceSearching(false)
    }
  }, [forceSearchAction, threadId, refetchSearch, currentPrefs])

  const handleThreadCreated = useCallback(
    (newThreadId: string) => {
      setActiveThreadId(newThreadId)
      refetchSearch()
    },
    [refetchSearch],
  )

  const handleNewChat = useCallback(async () => {
    if (activeSearch) {
      await cancelSearchAction({ searchId: activeSearch._id })
      setActiveThreadId(null)
      setLastSearchPrefs(null)
      await refetchSearch()
    }
  }, [activeSearch, cancelSearchAction, refetchSearch])

  // Redo search with updated filters
  const handleRedoSearch = useCallback(async () => {
    await handleForceSearch()
  }, [handleForceSearch])

  // Loading state
  if (searchLoading) {
    return (
      <div className='flex items-center justify-center py-12'>
        <Loader2 className='h-8 w-8 animate-spin text-muted-foreground' />
      </div>
    )
  }

  // No active thread - show welcome screen
  if (!threadId) {
    return (
      <div className='flex flex-col h-dvh'>
        <ChatHeader
          filtersChanged={false}
          hasActiveThread={false}
          isSearching={isForceSearching}
          onForceSearch={handleForceSearch}
        />

        <div className='flex-1 flex items-center justify-center p-4'>
          <div className='w-full max-w-2xl flex flex-col'>
            <div className='mb-4'>
              <div className='flex items-center gap-2 mb-2'>
                <MessageSquare className='h-6 w-6' />
                <h1 className='text-3xl font-semibold'>AI JOB SEARCH</h1>
              </div>
            </div>

            <JobMatcherRuntimeProvider onThreadCreated={handleThreadCreated} threadId={null}>
              <ComposerPrimitive.Root className='flex flex-col gap-3'>
                <ComposerPrimitive.Input
                  asChild
                  placeholder="I'll help you find jobs that match your skills and preferences. Start by telling me what you're looking for, or click 'Search Now' to find matches based on your profile."
                >
                  <textarea className='w-full min-h-40 border border-input bg-background px-4 py-3 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none' />
                </ComposerPrimitive.Input>
                <div className='flex gap-2 justify-end'>
                  <ComposerPrimitive.Send asChild>
                    <Button className='gap-2' size='lg'>
                      <Send className='h-4 w-4' />
                      Search Now
                    </Button>
                  </ComposerPrimitive.Send>
                </div>
              </ComposerPrimitive.Root>
            </JobMatcherRuntimeProvider>
          </div>
        </div>
      </div>
    )
  }

  // Active thread - show chat interface with generated Thread component
  return (
    <div className='flex flex-col h-dvh'>
      <ChatHeader
        filtersChanged={filtersChanged}
        hasActiveThread={true}
        isSearching={isForceSearching}
        onForceSearch={handleForceSearch}
        onNewChat={handleNewChat}
        onRedoSearch={handleRedoSearch}
      />

      <PlanHeader isAgentRunning={isForceSearching} threadId={threadId} />

      <JobMatcherRuntimeProvider onThreadCreated={handleThreadCreated} threadId={threadId}>
        <ResumeToolUI />
        <PreferencesToolUI />
        <CollectLocationToolUI />
        <SearchJobsToolUI />
        <QuestionToolUI />

        <div className='flex-1 overflow-hidden min-h-0'>
          <Thread />
        </div>
      </JobMatcherRuntimeProvider>
    </div>
  )
}
