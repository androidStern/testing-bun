import { convexQuery } from '@convex-dev/react-query'
import { useQuery } from '@tanstack/react-query'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect, useRef } from 'react'

import { api } from '../../../../convex/_generated/api'
import { CacheManagement } from '../../../components/admin/CacheManagement'
import { EmployerCard } from '../../../components/admin/EmployerCard'
import { JobSubmissionCard } from '../../../components/admin/JobSubmissionCard'
import { MessageCard } from '../../../components/admin/MessageCard'
import { ScrapedJobsTable } from '../../../components/admin/ScrapedJobsTable'
import { SenderCard } from '../../../components/admin/SenderCard'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../../components/ui/tabs'

export const Route = createFileRoute('/_authenticated/_admin/admin')({
  component: AdminDashboard,
  validateSearch: (search: Record<string, unknown>) => ({
    // Transit filters
    bus_accessible:
      search.bus_accessible === true || search.bus_accessible === 'true' ? true : undefined,
    is_easy_apply:
      search.is_easy_apply === true || search.is_easy_apply === 'true' ? true : undefined,
    is_urgent: search.is_urgent === true || search.is_urgent === 'true' ? true : undefined,
    job: (search.job as string) || undefined,
    page: Number(search.page) || 1,
    // Scraped jobs filters (only relevant when tab === 'scraped-jobs')
    q: (search.q as string) || '',
    rail_accessible:
      search.rail_accessible === true || search.rail_accessible === 'true' ? true : undefined,
    shift_afternoon:
      search.shift_afternoon === true || search.shift_afternoon === 'true' ? true : undefined,
    shift_evening:
      search.shift_evening === true || search.shift_evening === 'true' ? true : undefined,
    shift_flexible:
      search.shift_flexible === true || search.shift_flexible === 'true' ? true : undefined,
    shift_morning:
      search.shift_morning === true || search.shift_morning === 'true' ? true : undefined,
    shift_overnight:
      search.shift_overnight === true || search.shift_overnight === 'true' ? true : undefined,
    // Source filters
    source_craigslist:
      search.source_craigslist === true || search.source_craigslist === 'true' ? true : undefined,
    source_snagajob:
      search.source_snagajob === true || search.source_snagajob === 'true' ? true : undefined,
    tab: (search.tab as string) || 'pending-jobs',
    // Boolean filters - handle both boolean (from navigate) and string (from URL)
    // Second-chance tier filters (new multi-signal scoring)
    tier_high: search.tier_high === true || search.tier_high === 'true' ? true : undefined,
    tier_low: search.tier_low === true || search.tier_low === 'true' ? true : undefined,
    tier_medium: search.tier_medium === true || search.tier_medium === 'true' ? true : undefined,
    tier_unknown: search.tier_unknown === true || search.tier_unknown === 'true' ? true : undefined,
    tier_unlikely:
      search.tier_unlikely === true || search.tier_unlikely === 'true' ? true : undefined,
  }),
})

function AdminDashboard() {
  const { tab, job } = Route.useSearch()
  const navigate = useNavigate({ from: Route.fullPath })

  const setTab = (newTab: string) => {
    navigate({ search: prev => ({ ...prev, tab: newTab }), to: '.' })
  }

  return (
    <div className='mx-auto max-w-6xl p-6'>
      <h1 className='mb-6 text-2xl font-bold'>SMS Admin Dashboard</h1>

      <Tabs onValueChange={setTab} value={tab}>
        <TabsList className='mb-6 flex-wrap'>
          <TabsTrigger value='pending-jobs'>Pending Jobs</TabsTrigger>
          <TabsTrigger value='all-jobs'>All Jobs</TabsTrigger>
          <TabsTrigger value='pending-senders'>Pending Senders</TabsTrigger>
          <TabsTrigger value='all-senders'>All Senders</TabsTrigger>
          <TabsTrigger value='pending-messages'>Pending Messages</TabsTrigger>
          <TabsTrigger value='all-messages'>All Messages</TabsTrigger>
          <TabsTrigger value='pending-employers'>Pending Employers</TabsTrigger>
          <TabsTrigger value='all-employers'>All Employers</TabsTrigger>
          <TabsTrigger value='scraped-jobs'>Scraped Jobs</TabsTrigger>
          <TabsTrigger value='cache'>Cache</TabsTrigger>
        </TabsList>

        <TabsContent value='pending-jobs'>
          <PendingJobsTab highlightedJobId={job ?? null} />
        </TabsContent>

        <TabsContent value='all-jobs'>
          <AllJobsTab highlightedJobId={job ?? null} />
        </TabsContent>

        <TabsContent value='pending-senders'>
          <PendingSendersTab />
        </TabsContent>

        <TabsContent value='all-senders'>
          <AllSendersTab />
        </TabsContent>

        <TabsContent value='pending-messages'>
          <PendingMessagesTab />
        </TabsContent>

        <TabsContent value='all-messages'>
          <AllMessagesTab />
        </TabsContent>

        <TabsContent value='pending-employers'>
          <PendingEmployersTab />
        </TabsContent>

        <TabsContent value='all-employers'>
          <AllEmployersTab />
        </TabsContent>

        <TabsContent value='scraped-jobs'>
          <ScrapedJobsTable />
        </TabsContent>

        <TabsContent value='cache'>
          <CacheManagement />
        </TabsContent>
      </Tabs>
    </div>
  )
}

function PendingJobsTab({ highlightedJobId }: { highlightedJobId: string | null }) {
  const {
    data: jobs,
    isLoading,
    error,
  } = useQuery(convexQuery(api.jobSubmissions.list, { status: 'pending_approval' }))
  const highlightedRef = useRef<HTMLDivElement>(null)
  const hasScrolled = useRef(false)

  // Scroll to highlighted job when data loads
  useEffect(() => {
    if (highlightedJobId && jobs && !hasScrolled.current && highlightedRef.current) {
      highlightedRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' })
      hasScrolled.current = true
    }
  }, [highlightedJobId, jobs])

  if (isLoading) return <div className='text-gray-500'>Loading...</div>
  if (error) return <div className='text-red-500'>Error loading jobs</div>
  if (!jobs?.length) return <div className='text-gray-500'>No pending jobs</div>

  return (
    <div className='space-y-4'>
      {jobs.map(job => (
        <div
          className={job._id === highlightedJobId ? 'ring-2 ring-blue-500 rounded-lg' : undefined}
          key={job._id}
          ref={job._id === highlightedJobId ? highlightedRef : undefined}
        >
          <JobSubmissionCard job={job} showActions />
        </div>
      ))}
    </div>
  )
}

function AllJobsTab({ highlightedJobId }: { highlightedJobId: string | null }) {
  const { data: jobs, isLoading, error } = useQuery(convexQuery(api.jobSubmissions.list, {}))
  const highlightedRef = useRef<HTMLDivElement>(null)
  const hasScrolled = useRef(false)

  // Scroll to highlighted job when data loads
  useEffect(() => {
    if (highlightedJobId && jobs && !hasScrolled.current && highlightedRef.current) {
      highlightedRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' })
      hasScrolled.current = true
    }
  }, [highlightedJobId, jobs])

  if (isLoading) return <div className='text-gray-500'>Loading...</div>
  if (error) return <div className='text-red-500'>Error loading jobs</div>
  if (!jobs?.length) return <div className='text-gray-500'>No jobs yet</div>

  return (
    <div className='space-y-4'>
      {jobs.map(job => (
        <div
          className={job._id === highlightedJobId ? 'ring-2 ring-blue-500 rounded-lg' : undefined}
          key={job._id}
          ref={job._id === highlightedJobId ? highlightedRef : undefined}
        >
          <JobSubmissionCard job={job} showActions={job.status === 'pending_approval'} />
        </div>
      ))}
    </div>
  )
}

function PendingSendersTab() {
  const {
    data: senders,
    isLoading,
    error,
  } = useQuery(convexQuery(api.senders.list, { status: 'pending' }))

  if (isLoading) return <div className='text-gray-500'>Loading...</div>
  if (error) return <div className='text-red-500'>Error loading senders</div>
  if (!senders?.length) return <div className='text-gray-500'>No pending senders</div>

  return (
    <div className='space-y-4'>
      {senders.map(sender => (
        <SenderCard
          firstMessagePreview={sender.firstMessagePreview ?? undefined}
          key={sender._id}
          sender={sender as any}
          showActions
        />
      ))}
    </div>
  )
}

function AllSendersTab() {
  const { data: senders, isLoading, error } = useQuery(convexQuery(api.senders.list, {}))

  if (isLoading) return <div className='text-gray-500'>Loading...</div>
  if (error) return <div className='text-red-500'>Error loading senders</div>
  if (!senders?.length) return <div className='text-gray-500'>No senders yet</div>

  return (
    <div className='space-y-4'>
      {senders.map(sender => (
        <SenderCard
          firstMessagePreview={sender.firstMessagePreview ?? undefined}
          key={sender._id}
          sender={sender as any}
          showActions={sender.status === 'pending'}
        />
      ))}
    </div>
  )
}

function PendingMessagesTab() {
  const {
    data: messages,
    isLoading,
    error,
  } = useQuery(convexQuery(api.inboundMessages.list, { status: 'pending_review' }))

  if (isLoading) return <div className='text-gray-500'>Loading...</div>
  if (error) return <div className='text-red-500'>Error loading messages</div>
  if (!messages?.length) return <div className='text-gray-500'>No pending messages</div>

  return (
    <div className='space-y-4'>
      {messages.map(message => (
        <MessageCard key={message._id} message={message} showActions />
      ))}
    </div>
  )
}

function AllMessagesTab() {
  const { data: messages, isLoading, error } = useQuery(convexQuery(api.inboundMessages.list, {}))

  if (isLoading) return <div className='text-gray-500'>Loading...</div>
  if (error) return <div className='text-red-500'>Error loading messages</div>
  if (!messages?.length) return <div className='text-gray-500'>No messages yet</div>

  return (
    <div className='space-y-4'>
      {messages.map(message => (
        <MessageCard
          key={message._id}
          message={message}
          showActions={message.status === 'pending_review' || message.status === 'approved'}
        />
      ))}
    </div>
  )
}

function PendingEmployersTab() {
  const {
    data: employers,
    isLoading,
    error,
  } = useQuery(convexQuery(api.employers.list, { status: 'pending_review' as const }))

  if (isLoading) return <div className='text-gray-500'>Loading...</div>
  if (error) return <div className='text-red-500'>Error loading employers</div>
  if (!employers?.length) return <div className='text-gray-500'>No pending employer accounts</div>

  return (
    <div className='space-y-4'>
      {employers.map(employer => (
        <EmployerCard employer={employer as any} key={employer._id} showActions />
      ))}
    </div>
  )
}

function AllEmployersTab() {
  const { data: employers, isLoading, error } = useQuery(convexQuery(api.employers.list, {}))

  if (isLoading) return <div className='text-gray-500'>Loading...</div>
  if (error) return <div className='text-red-500'>Error loading employers</div>
  if (!employers?.length) return <div className='text-gray-500'>No employer accounts yet</div>

  return (
    <div className='space-y-4'>
      {employers.map(employer => (
        <EmployerCard
          employer={employer as any}
          key={employer._id}
          showActions={employer.status === 'pending_review'}
        />
      ))}
    </div>
  )
}
