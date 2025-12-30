import { useUIMessages } from '@convex-dev/agent/react'
import { convexQuery } from '@convex-dev/react-query'
import { useQuery } from '@tanstack/react-query'
import { useAction } from 'convex/react'
import { AlertCircle, Loader2, MessageSquare, Search } from 'lucide-react'
import { type FormEvent, useId, useMemo, useState } from 'react'

import { api } from '../../convex/_generated/api'
import { JobMatchResults } from './JobMatchResults'
import { Button } from './ui/button'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { Input } from './ui/input'

interface JobMatcherProps {
  workosUserId: string
}

export function JobMatcher({ workosUserId }: JobMatcherProps) {
  const formId = useId()
  const [prompt, setPrompt] = useState('Find jobs matching my resume and preferences')
  const [followUpInput, setFollowUpInput] = useState('')
  const [showChat, setShowChat] = useState(false)
  const [isStarting, setIsStarting] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Check for active search
  const {
    data: activeSearch,
    isLoading: searchLoading,
    refetch: refetchSearch,
  } = useQuery(convexQuery(api.jobMatcher.queries.getActiveSearch, {}))

  // Subscribe to thread messages (survives page refresh!)
  const { results: messages, status: streamStatus } = useUIMessages(
    api.jobMatcher.messages.listThreadMessages,
    activeSearch ? { threadId: activeSearch.threadId } : 'skip',
    { initialNumItems: 50, stream: true },
  )

  // Actions for starting/continuing search
  const startSearchAction = useAction(api.jobMatcher.actions.startSearch)
  const sendMessageAction = useAction(api.jobMatcher.actions.sendMessage)
  const cancelSearchAction = useAction(api.jobMatcher.actions.cancelSearch)

  // Check if agent is actively streaming by looking at last message status
  const isStreaming = useMemo(() => {
    if (!activeSearch || !messages?.length) return false
    const lastMsg = messages[messages.length - 1]
    return lastMsg?.status === 'streaming'
  }, [activeSearch, messages])

  const isProcessing = isStarting || isSending || isStreaming

  const handleStartSearch = async (e: FormEvent) => {
    e.preventDefault()
    if (!prompt.trim() || isProcessing) return

    setError(null)
    setIsStarting(true)
    try {
      await startSearchAction({
        prompt: prompt.trim(),
        threadId: activeSearch?.threadId,
      })
      // Refetch to get the new search record
      await refetchSearch()
    } catch (err) {
      console.error('Error starting search:', err)
      setError(err instanceof Error ? err.message : 'Failed to start search')
    } finally {
      setIsStarting(false)
    }
  }

  const handleFollowUp = async (e: FormEvent) => {
    e.preventDefault()
    if (!followUpInput.trim() || !activeSearch || isProcessing) return

    setError(null)
    setIsSending(true)
    try {
      await sendMessageAction({
        message: followUpInput.trim(),
        threadId: activeSearch.threadId,
      })
      setFollowUpInput('')
    } catch (err) {
      console.error('Error sending message:', err)
      setError(err instanceof Error ? err.message : 'Failed to send message')
    } finally {
      setIsSending(false)
    }
  }

  const handleNewSearch = async () => {
    if (!activeSearch) return
    setError(null)
    try {
      await cancelSearchAction({ searchId: activeSearch._id })
      await refetchSearch()
    } catch (err) {
      console.error('Error cancelling search:', err)
      setError(err instanceof Error ? err.message : 'Failed to cancel search')
    }
  }

  if (searchLoading) {
    return (
      <div className='flex items-center justify-center py-12'>
        <Loader2 className='h-8 w-8 animate-spin text-muted-foreground' />
      </div>
    )
  }

  // No active search - show search form
  if (!activeSearch) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className='flex items-center gap-2'>
            <Search className='h-5 w-5' />
            AI-Powered Job Search
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className='text-muted-foreground mb-4'>
            Our AI will analyze your resume and preferences to find the best job matches for you.
          </p>

          <form className='space-y-4' onSubmit={handleStartSearch}>
            <div>
              <label className='text-sm font-medium mb-2 block' htmlFor={`${formId}-prompt`}>
                What are you looking for?
              </label>
              <Input
                disabled={isStarting}
                id={`${formId}-prompt`}
                onChange={e => setPrompt(e.target.value)}
                placeholder='Find jobs matching my resume and preferences'
                value={prompt}
              />
              <p className='text-xs text-muted-foreground mt-1'>
                You can customize this or use the default prompt
              </p>
            </div>

            <Button className='w-full' disabled={isStarting || !prompt.trim()} type='submit'>
              {isStarting ? (
                <>
                  <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                  Starting search...
                </>
              ) : (
                <>
                  <Search className='mr-2 h-4 w-4' />
                  Find Jobs For Me
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    )
  }

  // Use error state for display
  const displayError = error

  // Active search - show results and chat
  return (
    <div className='space-y-6'>
      {/* Error display */}
      {displayError && (
        <Card className='border-destructive bg-destructive/10'>
          <CardContent className='py-4'>
            <div className='flex items-start gap-3'>
              <AlertCircle className='h-5 w-5 text-destructive mt-0.5' />
              <div>
                <p className='font-medium text-destructive'>Error</p>
                <p className='text-sm text-destructive/80'>{displayError}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Results */}
      <JobMatchResults isStarting={isStarting} isStreaming={isStreaming} messages={messages ?? []} />

      {/* Debug info - shows stream status for debugging */}
      {process.env.NODE_ENV === 'development' && (
        <Card className='border-dashed border-muted-foreground/50'>
          <CardContent className='py-3'>
            <p className='text-xs text-muted-foreground font-mono'>
              Debug: threadId={activeSearch.threadId} | status={streamStatus} | messages=
              {messages?.length ?? 0}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Follow-up section */}
      <Card>
        <CardContent className='pt-6'>
          {!showChat ? (
            <div className='flex flex-col sm:flex-row gap-3'>
              <Button
                className='flex-1'
                disabled={isStreaming}
                onClick={() => setShowChat(true)}
                variant='outline'
              >
                <MessageSquare className='mr-2 h-4 w-4' />
                Ask a follow-up question
              </Button>
              <Button
                className='flex-1'
                disabled={isStreaming}
                onClick={() => {
                  handleNewSearch()
                }}
                type='button'
                variant='outline'
              >
                <Search className='mr-2 h-4 w-4' />
                Start new search
              </Button>
            </div>
          ) : (
            <form className='space-y-3' onSubmit={handleFollowUp}>
              <Input
                disabled={isSending || isStreaming}
                onChange={e => setFollowUpInput(e.target.value)}
                placeholder='Ask about jobs, refine your search...'
                value={followUpInput}
              />
              <div className='flex gap-2'>
                <Button disabled={isSending || isStreaming || !followUpInput.trim()} type='submit'>
                  {isSending ? (
                    <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                  ) : (
                    <MessageSquare className='mr-2 h-4 w-4' />
                  )}
                  Send
                </Button>
                <Button onClick={() => setShowChat(false)} type='button' variant='ghost'>
                  Cancel
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
