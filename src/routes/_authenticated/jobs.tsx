import { createFileRoute } from '@tanstack/react-router'
import { getAuth } from '@workos/authkit-tanstack-react-start'

import { JobMatcher } from '../../components/JobMatcher'
import { JobPreferencesForm } from '../../components/JobPreferencesForm'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs'
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

  return (
    <div className='min-h-screen bg-background'>
      <div className='container mx-auto max-w-4xl py-8 px-4'>
        <h1 className='text-3xl font-bold mb-6'>Find Jobs</h1>

        <Tabs className='w-full' defaultValue='search'>
          <TabsList className='mb-6'>
            <TabsTrigger value='search'>Job Search</TabsTrigger>
            <TabsTrigger value='preferences'>Preferences</TabsTrigger>
          </TabsList>

          <TabsContent value='search'>
            <JobMatcher workosUserId={user.id} />
          </TabsContent>

          <TabsContent value='preferences'>
            <JobPreferencesForm />
          </TabsContent>
        </Tabs>
      </div>
      <Toaster />
    </div>
  )
}
