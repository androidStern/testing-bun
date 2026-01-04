'use client'

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
import { ResumeIncompleteCard } from './ResumeIncompleteCard'
import { ResumeUploadCard } from './ResumeUploadCard'

const RESUME_MIN_LENGTH = 100

type ResumeDoc = {
  summary?: string
  skills?: string
  workExperience?: Array<{
    position?: string
    company?: string
    description?: string
    achievements?: string
  }>
  education?: Array<{
    institution?: string
    degree?: string
    field?: string
    description?: string
  }>
}

function getResumeSubstantiveLength(resume: ResumeDoc | null | undefined): number {
  if (!resume) return 0

  const parts: string[] = []

  if (resume.summary) parts.push(resume.summary)
  if (resume.skills) parts.push(resume.skills)

  for (const exp of resume.workExperience ?? []) {
    if (exp.position) parts.push(exp.position)
    if (exp.company) parts.push(exp.company)
    if (exp.description) parts.push(exp.description)
    if (exp.achievements) parts.push(exp.achievements)
  }

  for (const edu of resume.education ?? []) {
    if (edu.institution) parts.push(edu.institution)
    if (edu.degree) parts.push(edu.degree)
    if (edu.field) parts.push(edu.field)
    if (edu.description) parts.push(edu.description)
  }

  return parts.join('').length
}

import {
  CollectLocationToolUI,
  PreferencesToolUI,
  QuestionToolUI,
  ResumeToolUI,
  SearchJobsToolUI,
} from './tools'

interface JobMatcherChatProps {
  user: {
    id: string
    email?: string
    firstName?: string | null
    lastName?: string | null
  }
  initialPrompt?: string
}

/**
 * JobMatcherChat - Main chat interface for the job matcher.
 *
 * Features:
 * - Header with preference controls and Force Search button
 * - Chat messages with tool activity visualization
 * - Quick-reply buttons for Q&A
 * - Inline job results
 * - Persistent chat history via Convex Agent
 * - Resume upload gate on first message (if no resume exists)
 */
export function JobMatcherChat({ user, initialPrompt }: JobMatcherChatProps) {
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null)
  const [lastSearchPrefs, setLastSearchPrefs] = useState<JobPreferences | null>(null)
  const [pendingMessage, setPendingMessage] = useState<string | null>(null)
  const [resumeGateReason, setResumeGateReason] = useState<'missing' | 'incomplete' | null>(null)
  const [inputValue, setInputValue] = useState(initialPrompt ?? '')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const { data: existingResume } = useQuery(
    convexQuery(api.resumes.getByWorkosUserId, { workosUserId: user.id }),
  )

  const {
    data: activeSearch,
    isLoading: searchLoading,
    refetch: refetchSearch,
  } = useQuery(convexQuery(api.jobMatcher.queries.getActiveSearch, {}))

  const { data: currentPrefs } = useQuery(convexQuery(api.jobPreferences.get, {}))

  // Detect if filters have changed since last search
  const filtersChanged = useMemo(() => {
    if (!lastSearchPrefs || !currentPrefs) return false
    return JSON.stringify(lastSearchPrefs) !== JSON.stringify(currentPrefs)
  }, [lastSearchPrefs, currentPrefs])

  // Use active search's thread ID if available
  const threadId = activeThreadId ?? activeSearch?.threadId ?? null

  const forceSearchAction = useAction(api.jobMatcher.actions.forceSearch)
  const cancelSearchAction = useAction(api.jobMatcher.actions.cancelSearch)
  const startSearchAction = useAction(api.jobMatcher.actions.startSearch)

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

  const handleRedoSearch = useCallback(async () => {
    await handleForceSearch()
  }, [handleForceSearch])

  const startSearch = useCallback(
    async (text: string) => {
      setIsSubmitting(true)
      try {
        const result = await startSearchAction({ prompt: text })
        setActiveThreadId(result.threadId)
        setInputValue('')
        await refetchSearch()
      } finally {
        setIsSubmitting(false)
      }
    },
    [startSearchAction, refetchSearch],
  )

  const handleWelcomeSubmit = useCallback(async () => {
    const text = inputValue.trim()
    if (!text) return

    if (!existingResume) {
      setPendingMessage(text)
      setResumeGateReason('missing')
      return
    }

    const substantiveLength = getResumeSubstantiveLength(existingResume)
    if (substantiveLength < RESUME_MIN_LENGTH) {
      setPendingMessage(text)
      setResumeGateReason('incomplete')
      return
    }

    await startSearch(text)
  }, [inputValue, existingResume, startSearch])

  const handleResumeFlowComplete = useCallback(async () => {
    const message = pendingMessage
    setPendingMessage(null)
    setResumeGateReason(null)
    if (message) {
      await startSearch(message)
    }
  }, [pendingMessage, startSearch])

  // Loading state
  if (searchLoading) {
    return (
      <div className='flex items-center justify-center py-12'>
        <Loader2 className='h-8 w-8 animate-spin text-muted-foreground' />
      </div>
    )
  }

  if (!threadId) {
    if (pendingMessage) {
      return (
        <div className='flex flex-col h-dvh'>
          <ChatHeader
            filtersChanged={false}
            hasActiveThread={false}
            isSearching={isForceSearching}
            onForceSearch={handleForceSearch}
          />
          <div className='flex flex-1 items-center justify-center p-4'>
            {resumeGateReason === 'missing' ? (
              <ResumeUploadCard
                onComplete={handleResumeFlowComplete}
                pendingSearch={pendingMessage}
                workosUserId={user.id}
              />
            ) : (
              <ResumeIncompleteCard
                onComplete={handleResumeFlowComplete}
                pendingSearch={pendingMessage}
              />
            )}
          </div>
        </div>
      )
    }

    return (
      <div className='flex flex-col h-dvh'>
        <ChatHeader
          filtersChanged={false}
          hasActiveThread={false}
          isSearching={isForceSearching}
          onForceSearch={handleForceSearch}
        />

        <div className='flex flex-1 items-center justify-center p-4'>
          <div className='flex w-full max-w-2xl flex-col'>
            <div className='mb-4'>
              <div className='mb-2 flex items-center gap-2'>
                <MessageSquare className='h-6 w-6' />
                <h1 className='text-3xl font-semibold'>AI JOB SEARCH</h1>
              </div>
            </div>

            <div className='flex flex-col gap-3'>
              <textarea
                className='w-full min-h-40 resize-none border border-input bg-background px-4 py-3 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
                disabled={isSubmitting}
                onChange={e => setInputValue(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    handleWelcomeSubmit()
                  }
                }}
                placeholder="I'll help you find jobs that match your skills and preferences. Start by telling me what you're looking for, or click 'Search Now' to find matches based on your profile."
                value={inputValue}
              />
              <div className='flex justify-end gap-2'>
                <Button
                  className='gap-2'
                  disabled={isSubmitting || !inputValue.trim()}
                  onClick={handleWelcomeSubmit}
                  size='lg'
                >
                  {isSubmitting ? (
                    <Loader2 className='h-4 w-4 animate-spin' />
                  ) : (
                    <Send className='h-4 w-4' />
                  )}
                  Search Now
                </Button>
              </div>
            </div>
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
