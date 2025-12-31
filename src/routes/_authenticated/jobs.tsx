import { createFileRoute } from '@tanstack/react-router'
import { getAuth } from '@workos/authkit-tanstack-react-start'

import { JobMatcherChat } from '../../components/chat/JobMatcherChat'
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
  return (
    <div className='min-h-screen bg-background'>
      <div className='container mx-auto max-w-4xl px-4'>
        {/* AI Job Matcher Chat - Full chat interface with built-in header */}
        <JobMatcherChat />
      </div>
      <Toaster />
    </div>
  )
}
