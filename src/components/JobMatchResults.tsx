import { SmoothText  } from '@convex-dev/agent/react'
import {
  Clock,
  DollarSign,
  ExternalLink,
  FileText,
  Loader2,
  MapPin,
  Search,
  Settings,
  Star,
} from 'lucide-react'
import { useMemo } from 'react'

import { Badge } from './ui/badge'
import { Button } from './ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card'
import type {UIMessage} from '@convex-dev/agent/react';

interface JobMatch {
  id: string
  title: string
  company: string
  location: string | null
  matchReason: string
  highlights: Array<string>
  salary: string | null
  isSecondChance: boolean
  shifts: Array<string>
  url: string
}

interface ParsedResponse {
  summary: string
  jobs: Array<JobMatch>
  suggestions?: Array<string>
}

interface JobMatchResultsProps {
  messages: Array<UIMessage>
  isStreaming: boolean
  isStarting?: boolean // Search action called but no messages yet
}

// Helper to format filters for display
function formatFilters(filters: Record<string, unknown>): string {
  const parts: Array<string> = []
  if (filters.second_chance_only) parts.push('second-chance')
  if (filters.city) parts.push(`city: ${filters.city}`)
  if (filters.state) parts.push(`state: ${filters.state}`)
  if (filters.shifts && Array.isArray(filters.shifts)) {
    parts.push(`shifts: ${filters.shifts.join(', ')}`)
  }
  if (filters.bus_accessible) parts.push('bus')
  if (filters.rail_accessible) parts.push('rail')
  if (filters.urgent_only) parts.push('urgent')
  if (filters.easy_apply_only) parts.push('easy apply')
  return parts.length > 0 ? parts.join(' | ') : 'none'
}

// Tool call part type - flexible interface for tool-related parts
// Note: Convex Agent library uses 'input'/'output' not 'args'/'result'
interface ToolPartData {
  type: string
  toolName?: string
  input?: Record<string, unknown>
  output?: unknown
  state?: string // 'input-streaming' | 'input-available' | 'output-available' | 'output-error'
}

// Type guard to check if a part is tool-related
function isToolPart(p: unknown): boolean {
  if (typeof p !== 'object' || p === null || !('type' in p)) return false
  const type = (p as { type: unknown }).type
  return type === 'tool-call' || type === 'tool-result' || String(type).startsWith('tool-')
}

// Component to show what the agent is doing
function AgentActivity({ message }: { message: UIMessage }) {
  const toolParts = useMemo(() => {
    return message.parts.filter(isToolPart) as unknown as Array<ToolPartData>
  }, [message.parts])

  if (toolParts.length === 0) return null

  return (
    <div className='space-y-2'>
      {toolParts.map((part, idx) => (
        <ToolCallCard key={`tool-${idx}`} part={part} />
      ))}
    </div>
  )
}

function ToolCallCard({ part }: { part: ToolPartData }) {
  const isDev = process.env.NODE_ENV === 'development'
  const toolName = part.toolName ?? part.type.replace('tool-', '')

  // Friendly summary based on tool name
  const renderSummary = () => {
    if (toolName === 'searchJobs') {
      const input = part.input as { query?: string; filters?: Record<string, unknown>; limit?: number } | undefined
      const output = part.output as Array<unknown> | undefined
      return (
        <>
          <div className='flex items-center gap-2 font-medium'>
            <Search className='h-4 w-4 text-blue-600' />
            <span>Searching for: &quot;{input?.query ?? '...'}&quot;</span>
          </div>
          {input?.filters && Object.keys(input.filters).length > 0 && (
            <div className='mt-1 text-muted-foreground'>Filters: {formatFilters(input.filters)}</div>
          )}
          {output && Array.isArray(output) && (
            <div className='mt-1 text-green-600'>Found {output.length} jobs</div>
          )}
        </>
      )
    }

    if (toolName === 'getMyResume') {
      const output = part.output as { skills?: string; summary?: string } | null | undefined
      return (
        <>
          <div className='flex items-center gap-2'>
            <FileText className='h-4 w-4 text-purple-600' />
            <span>Reading your resume...</span>
          </div>
          {output && (
            <div className='mt-1 text-green-600'>
              {output.skills
                ? `Found skills: ${output.skills.substring(0, 60)}${output.skills.length > 60 ? '...' : ''}`
                : output.summary
                  ? `Summary: ${output.summary.substring(0, 60)}...`
                  : 'Resume loaded'}
            </div>
          )}
          {output === null && <div className='mt-1 text-amber-600'>No resume found</div>}
        </>
      )
    }

    if (toolName === 'getMyJobPreferences') {
      const output = part.output as {
        maxCommuteMinutes?: number
        requireSecondChance?: boolean
        hasHomeLocation?: boolean
        hasTransitZones?: boolean
      } | undefined
      return (
        <>
          <div className='flex items-center gap-2'>
            <Settings className='h-4 w-4 text-orange-600' />
            <span>Loading your preferences...</span>
          </div>
          {output && (
            <div className='mt-1 text-green-600'>
              Commute: {output.maxCommuteMinutes ?? 'no limit'}min
              {output.requireSecondChance && ' | Second-chance only'}
              {output.hasHomeLocation && ' | Home set'}
              {output.hasTransitZones && ' | Transit zones active'}
            </div>
          )}
        </>
      )
    }

    return (
      <div className='flex items-center gap-2'>
        <span className='text-muted-foreground'>Tool: {toolName}</span>
      </div>
    )
  }

  return (
    <div className='bg-muted/50 rounded-lg p-3 text-sm'>
      {renderSummary()}

      {/* Dev-only: expandable raw JSON */}
      {isDev && (
        <details className='mt-2 text-xs'>
          <summary className='cursor-pointer text-muted-foreground hover:text-foreground'>
            Debug: View raw data
          </summary>
          <pre className='mt-2 p-2 bg-background rounded overflow-x-auto max-h-48'>
            {JSON.stringify({ toolName, input: part.input, output: part.output, state: part.state }, null, 2)}
          </pre>
        </details>
      )}
    </div>
  )
}

export function JobMatchResults({ messages, isStreaming, isStarting }: JobMatchResultsProps) {
  // Find the latest assistant message with job results
  // Check msg.object first (structured output), then fall back to text parsing
  const latestResult = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      const msg = messages[i]
      if (msg.role === 'assistant') {
        // Debug: log what we're checking
        if (process.env.NODE_ENV === 'development') {
          console.log(`[JobMatchResults] Checking msg ${i}:`, {
            hasObject: 'object' in msg,
            objectType: typeof (msg as UIMessage & { object?: unknown }).object,
            hasText: !!msg.text,
            textPreview: msg.text?.substring(0, 50),
          })
        }

        // Check for structured object output first (from generateObject)
        const msgObj = msg as UIMessage & { object?: unknown }
        if (msgObj.object && typeof msgObj.object === 'object') {
          const obj = msgObj.object as { jobs?: unknown }
          if (Array.isArray(obj.jobs)) {
            return obj as ParsedResponse
          }
        }
        // Fallback to text parsing for backwards compatibility
        if (msg.text) {
          try {
            const parsed = JSON.parse(msg.text) as ParsedResponse
            if (Array.isArray(parsed.jobs)) {
              return parsed
            }
          } catch {
            // Not JSON - ignore
          }
        }
      }
    }
    return null
  }, [messages])

  // Get all assistant messages with tool activity
  const allToolActivity = useMemo(() => {
    return messages.filter(m => m.role === 'assistant' && m.parts?.length > 0)
  }, [messages])

  // Get the last message for streaming display
  const lastMessage = messages[messages.length - 1]

  // Get the last assistant message (for display in fallback states)
  const lastAssistantMsg = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === 'assistant') return messages[i]
    }
    return null
  }, [messages])

  // FIX: Check if ANY message has tools (not just the last one)
  // Phase 2 (generateObject) creates a new message WITHOUT tools,
  // so checking only the last message would fail
  const anyMsgHasTools = useMemo(() => {
    return messages.some(
      m => m.role === 'assistant' && m.parts?.some(p => isToolPart(p))
    )
  }, [messages])

  // ===== RENDER STATES (in strict priority order) =====

  // State 1: No messages yet - ALWAYS show loading
  // This component only renders when activeSearch exists,
  // so empty messages means subscription is still loading
  // FIX: Previously returned null here, causing flash of follow-up buttons
  if (messages.length === 0) {
    return (
      <Card>
        <CardContent className='py-6'>
          <div className='flex items-center gap-3'>
            <Loader2 className='h-5 w-5 animate-spin text-primary' />
            <span className='font-medium'>Starting job search...</span>
          </div>
        </CardContent>
      </Card>
    )
  }

  // State 2: Actively streaming (Phase 1 tools running)
  if (isStreaming) {
    return (
      <Card>
        <CardContent className='py-6'>
          <div className='space-y-4'>
            <div className='flex items-center gap-3'>
              <Loader2 className='h-5 w-5 animate-spin text-primary' />
              <span className='font-medium'>Finding jobs for you...</span>
            </div>
            {/* Show tool activity */}
            {lastMessage && <AgentActivity message={lastMessage} />}
            {/* Streaming text */}
            {lastMessage?.text && (
              <div className='text-sm text-muted-foreground border-l-2 border-primary/20 pl-3'>
                <SmoothText text={lastMessage.text} />
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    )
  }

  // State 3: Have results → Show them immediately
  // FIX: Check for results BEFORE checking for processing state
  if (latestResult) {
    return (
      <div className='space-y-4'>
        {/* Collapsible tool activity */}
        {allToolActivity.length > 0 && (
          <Card>
            <CardContent className='py-3'>
              <details>
                <summary className='cursor-pointer text-sm font-medium flex items-center gap-2'>
                  <Search className='h-4 w-4' />
                  View search activity ({allToolActivity.length} steps)
                </summary>
                <div className='mt-3 space-y-2'>
                  {allToolActivity.map((msg, idx) => (
                    <AgentActivity key={`activity-${idx}`} message={msg} />
                  ))}
                </div>
              </details>
            </CardContent>
          </Card>
        )}

        {/* Summary */}
        <Card>
          <CardHeader>
            <CardTitle>Search Results</CardTitle>
            <CardDescription>{latestResult.summary}</CardDescription>
          </CardHeader>
        </Card>

        {/* Job Cards */}
        <div className='grid gap-4'>
          {latestResult.jobs.map(job => (
            <JobCard job={job} key={job.id} />
          ))}
        </div>

        {/* Suggestions */}
        {latestResult.suggestions && latestResult.suggestions.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className='text-base'>Suggestions</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className='list-disc list-inside space-y-1 text-sm text-muted-foreground'>
                {latestResult.suggestions.map(suggestion => (
                  <li key={suggestion}>{suggestion}</li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}
      </div>
    )
  }

  // State 4: Tools ran but no results yet → Still processing (Phase 2)
  // FIX: Check if ANY message has tools, not just the last one
  // Phase 2 (generateObject) creates a new message WITHOUT tools
  if (anyMsgHasTools) {
    return (
      <Card>
        <CardContent className='py-6'>
          <div className='space-y-4'>
            <div className='flex items-center gap-3'>
              <Loader2 className='h-5 w-5 animate-spin text-primary' />
              <span className='font-medium'>Analyzing results...</span>
            </div>
            {/* Show what tools found */}
            {lastAssistantMsg && <AgentActivity message={lastAssistantMsg} />}
          </div>
        </CardContent>
      </Card>
    )
  }

  // State 5: No tools ran, no results → Show last text or empty state
  if (lastAssistantMsg?.text) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Agent Response</CardTitle>
          <CardDescription>The agent responded but didn't return structured job data.</CardDescription>
        </CardHeader>
        <CardContent>
          <p className='text-sm whitespace-pre-wrap'>{lastAssistantMsg.text}</p>
        </CardContent>
      </Card>
    )
  }

  // State 6: Truly empty (shouldn't happen normally)
  return (
    <Card>
      <CardContent className='py-8'>
        <p className='text-muted-foreground text-center'>
          No job matches found yet. Try adjusting your search.
        </p>
      </CardContent>
    </Card>
  )
}

function JobCard({ job }: { job: JobMatch }) {
  return (
    <Card className='hover:shadow-md transition-shadow'>
      <CardHeader className='pb-2'>
        <div className='flex items-start justify-between gap-4'>
          <div>
            <CardTitle className='text-lg'>{job.title}</CardTitle>
            <CardDescription className='text-base font-medium'>{job.company}</CardDescription>
          </div>
          <div className='flex flex-wrap gap-1'>
            {job.isSecondChance && (
              <Badge className='bg-green-100 text-green-800' variant='secondary'>
                <Star className='h-3 w-3 mr-1' />
                Second Chance
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className='space-y-3'>
        {/* Location & Salary */}
        <div className='flex flex-wrap gap-4 text-sm text-muted-foreground'>
          {job.location && (
            <span className='flex items-center gap-1'>
              <MapPin className='h-4 w-4' />
              {job.location}
            </span>
          )}
          {job.salary && (
            <span className='flex items-center gap-1'>
              <DollarSign className='h-4 w-4' />
              {job.salary}
            </span>
          )}
        </div>

        {/* Shifts */}
        {job.shifts.length > 0 && (
          <div className='flex items-center gap-2'>
            <Clock className='h-4 w-4 text-muted-foreground' />
            <div className='flex flex-wrap gap-1'>
              {job.shifts.map(shift => (
                <Badge className='text-xs capitalize' key={shift} variant='outline'>
                  {shift}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Match Reason */}
        <div className='bg-muted/50 rounded-md p-3'>
          <p className='text-sm font-medium mb-1'>Why this matches:</p>
          <p className='text-sm text-muted-foreground'>{job.matchReason}</p>
        </div>

        {/* Highlights */}
        {job.highlights.length > 0 && (
          <ul className='text-sm space-y-1'>
            {job.highlights.map(highlight => (
              <li className='flex items-start gap-2' key={highlight}>
                <span className='text-primary'>•</span>
                {highlight}
              </li>
            ))}
          </ul>
        )}

        {/* Apply Button */}
        <Button asChild className='w-full mt-2'>
          <a href={job.url} rel='noopener noreferrer' target='_blank'>
            Apply Now
            <ExternalLink className='ml-2 h-4 w-4' />
          </a>
        </Button>
      </CardContent>
    </Card>
  )
}
