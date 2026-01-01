'use client'

import {
  ComposerPrimitive,
  MessagePrimitive,
  ThreadPrimitive,
} from '@assistant-ui/react'
import { MarkdownTextPrimitive } from '@assistant-ui/react-markdown'
import { convexQuery } from '@convex-dev/react-query'
import { useQuery } from '@tanstack/react-query'
import { useAction } from 'convex/react'
import { Loader2, MessageSquare, Send } from 'lucide-react'
import { useCallback, useState } from 'react'

import { api } from '../../../convex/_generated/api'
import { Button } from '../ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card'
import { ChatHeader } from './ChatHeader'
import { JobMatcherRuntimeProvider } from './JobMatcherRuntimeProvider'
import {
  ResumeToolUI,
  PreferencesToolUI,
  SearchJobsToolUI,
  QuestionToolUI,
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

  // Check for existing active search
  const { data: activeSearch, isLoading: searchLoading, refetch: refetchSearch } = useQuery(
    convexQuery(api.jobMatcher.queries.getActiveSearch, {})
  )

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
      const result = await forceSearchAction({ threadId: threadId ?? undefined })
      if (result.isNew) {
        setActiveThreadId(result.threadId)
        await refetchSearch()
      }
    } finally {
      setIsForceSearching(false)
    }
  }, [forceSearchAction, threadId, refetchSearch])

  const handleThreadCreated = useCallback(
    (newThreadId: string) => {
      setActiveThreadId(newThreadId)
      refetchSearch()
    },
    [refetchSearch]
  )

  const handleNewChat = useCallback(async () => {
    if (activeSearch) {
      await cancelSearchAction({ searchId: activeSearch._id })
      setActiveThreadId(null)
      await refetchSearch()
    }
  }, [activeSearch, cancelSearchAction, refetchSearch])

  // Loading state
  if (searchLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  // No active thread - show welcome screen
  if (!threadId) {
    return (
      <div className="flex flex-col h-[calc(100vh-8rem)]">
        <ChatHeader
          onForceSearch={handleForceSearch}
          isSearching={isForceSearching}
          hasActiveThread={false}
        />

        <div className="flex-1 flex items-center justify-center p-4">
          <div className="w-full max-w-2xl flex flex-col">
            <div className="mb-4">
              <div className="flex items-center gap-2 mb-2">
                <MessageSquare className="h-6 w-6" />
                <h1 className="text-3xl font-semibold">AI JOB SEARCH</h1>
              </div>
            </div>

            <JobMatcherRuntimeProvider threadId={null} onThreadCreated={handleThreadCreated}>
              <ComposerPrimitive.Root className="flex flex-col gap-3">
                <ComposerPrimitive.Input
                  asChild
                  placeholder="I'll help you find jobs that match your skills and preferences. Start by telling me what you're looking for, or click 'Search Now' to find matches based on your profile."
                >
                  <textarea
                    className="w-full min-h-40 rounded-xl border border-input bg-background px-4 py-3 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
                  />
                </ComposerPrimitive.Input>
                <div className="flex gap-2 justify-end">
                  <ComposerPrimitive.Send asChild>
                    <Button size="lg" className="gap-2">
                      <Send className="h-4 w-4" />
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

  // Active thread - show chat interface
  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      <ChatHeader
        onForceSearch={handleForceSearch}
        isSearching={isForceSearching}
        hasActiveThread={true}
      />

      <JobMatcherRuntimeProvider threadId={threadId} onThreadCreated={handleThreadCreated}>
        {/* Register tool UIs */}
        <ResumeToolUI />
        <PreferencesToolUI />
        <SearchJobsToolUI />
        <QuestionToolUI />

        {/* Thread content */}
        <ThreadPrimitive.Root className="flex flex-col flex-1 overflow-hidden">
          <ThreadPrimitive.Viewport className="flex-1 overflow-y-auto">
            <ThreadPrimitive.Empty>
              <div className="flex items-center justify-center h-full text-muted-foreground">
                <p>Start a conversation to find jobs...</p>
              </div>
            </ThreadPrimitive.Empty>

            <div className="flex flex-col space-y-6">
              <ThreadPrimitive.Messages
                components={{
                  UserMessage: UserMessageComponent,
                  AssistantMessage: AssistantMessageComponent,
                }}
              />
            </div>

            <ThreadPrimitive.ViewportFooter className="sticky bottom-0">
              <ThreadPrimitive.ScrollToBottom asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 data-[at-bottom=true]:hidden"
                >
                  Scroll to bottom
                </Button>
              </ThreadPrimitive.ScrollToBottom>
            </ThreadPrimitive.ViewportFooter>
          </ThreadPrimitive.Viewport>

          {/* Composer */}
          <div className="border-t bg-background p-4">
            <ComposerPrimitive.Root className="flex gap-2">
              <ComposerPrimitive.Input
                placeholder="Ask about jobs or refine your search..."
                className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
              <ComposerPrimitive.Send asChild>
                <Button size="icon">
                  <Send className="h-4 w-4" />
                </Button>
              </ComposerPrimitive.Send>
            </ComposerPrimitive.Root>

            {/* Action buttons */}
            <div className="flex items-center justify-between mt-2 pt-2 border-t">
              <Button variant="ghost" size="sm" onClick={handleNewChat}>
                Start new search
              </Button>
            </div>
          </div>
        </ThreadPrimitive.Root>
      </JobMatcherRuntimeProvider>
    </div>
  )
}

/**
 * User message component
 */
function UserMessageComponent() {
  return (
    <div className="flex justify-end px-4 py-2">
      <div className="max-w-[80%] rounded-lg bg-primary text-primary-foreground px-4 py-2">
        <MessagePrimitive.Content />
      </div>
    </div>
  )
}

/**
 * Assistant message component with tool rendering
 */
function AssistantMessageComponent() {
  return (
    <div className="px-4 py-2 w-full min-w-0">
      <div className="max-w-[90%] w-full min-w-0">
        {/* Tool calls and text content are rendered via MessagePrimitive.Content */}
        {/* Tool UIs registered above will render for their respective tool calls */}
        {/* Job cards are rendered inline by SearchJobsToolUI */}
        <MessagePrimitive.Content
          components={{
            Text: MarkdownText,
          }}
        />
      </div>
    </div>
  )
}

/**
 * Markdown text renderer with styling
 */
function MarkdownText() {
  return (
    <div className="rounded-lg bg-muted/50 px-4 py-2 text-sm prose prose-sm prose-neutral dark:prose-invert max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
      <MarkdownTextPrimitive />
    </div>
  )
}
