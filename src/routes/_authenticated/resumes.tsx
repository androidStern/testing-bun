import { convexQuery } from '@convex-dev/react-query'
import type { ErrorComponentProps } from '@tanstack/react-router'
import { createFileRoute } from '@tanstack/react-router'
import { getAuth } from '@workos/authkit-tanstack-react-start'
import { api } from '../../../convex/_generated/api'
import { ResumeForm } from '../../components/ResumeForm'
import { Toaster } from '../../components/ui/toaster'

function ResumeError({ error, reset }: ErrorComponentProps) {
  return (
    <div className='flex-1 bg-background p-4 sm:p-6 lg:p-8'>
      <div className='max-w-2xl mx-auto bg-card rounded-lg shadow-sm sm:shadow-md p-6 sm:p-8 text-center'>
        <h1 className='text-2xl sm:text-3xl font-bold text-destructive mb-4'>
          Failed to Load Resume
        </h1>
        <p className='text-muted-foreground mb-6'>
          {error?.message || 'An unexpected error occurred'}
        </p>
        <button
          className='bg-primary text-primary-foreground px-6 py-2.5 rounded-md hover:bg-primary/90 transition-colors'
          onClick={() => reset()}
          type='button'
        >
          Try Again
        </button>
      </div>
    </div>
  )
}

export const Route = createFileRoute('/_authenticated/resumes')({
  component: ResumePage,
  errorComponent: ResumeError,
  loader: async ({ context }) => {
    const auth = await getAuth()

    if (!auth.user) {
      throw new Error('Not authenticated')
    }

    // Preload resume data - useSuspenseQuery won't suspend since data is cached
    await context.queryClient.ensureQueryData(
      convexQuery(api.resumes.getByWorkosUserId, {
        workosUserId: auth.user.id,
      }),
    )

    return {
      user: auth.user,
    }
  },
})

function ResumePage() {
  const { user } = Route.useLoaderData()

  return (
    <div className='min-h-screen bg-background'>
      <div className='container mx-auto md:py-8 md:px-4'>
        <ResumeForm user={user} />
      </div>
      <Toaster />
    </div>
  )
}
