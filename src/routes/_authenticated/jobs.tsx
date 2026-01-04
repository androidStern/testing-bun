import { createFileRoute, useSearch } from '@tanstack/react-router'
import { getAuth } from '@workos/authkit-tanstack-react-start'

import { JobMatcherChat } from '../../components/chat/JobMatcherChat'

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
  validateSearch: (search: Record<string, unknown>) => ({
    prompt: (search.prompt as string) || undefined,
  }),
})

function JobsPage() {
  const { user } = Route.useLoaderData()
  const { prompt } = useSearch({ from: '/_authenticated/jobs' })

  return (
    <div className='bg-background'>
      <JobMatcherChat initialPrompt={prompt} user={user} />
    </div>
  )
}
