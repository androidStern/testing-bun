import { convexQuery } from '@convex-dev/react-query'
import { useSuspenseQuery } from '@tanstack/react-query'
import type { ErrorComponentProps } from '@tanstack/react-router'
import { createFileRoute, useSearch } from '@tanstack/react-router'
import { getAuth } from '@workos/authkit-tanstack-react-start'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { api } from '../../../convex/_generated/api'
import { ResumeForm } from '../../components/ResumeForm'

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

function ResumeError({ error, reset }: ErrorComponentProps) {
  return (
    <div className='flex-1 bg-background p-4 sm:p-6 lg:p-8'>
      <Card className='max-w-2xl mx-auto'>
        <CardContent className='p-6 sm:p-8 text-center'>
          <h1 className='text-2xl sm:text-3xl font-bold text-destructive mb-4'>
            Failed to Load Resume
          </h1>
          <p className='text-muted-foreground mb-6'>
            {error?.message || 'An unexpected error occurred'}
          </p>
          <Button onClick={() => reset()}>Try Again</Button>
        </CardContent>
      </Card>
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

    await context.queryClient.ensureQueryData(
      convexQuery(api.resumes.getByWorkosUserId, {
        workosUserId: auth.user.id,
      }),
    )

    return {
      user: auth.user,
    }
  },
  validateSearch: (search: Record<string, unknown>) => ({
    returnPrompt: (search.returnPrompt as string) || undefined,
  }),
})

function ResumePage() {
  const { user } = Route.useLoaderData()
  const { returnPrompt } = useSearch({ from: '/_authenticated/resumes' })

  const { data: resume } = useSuspenseQuery(
    convexQuery(api.resumes.getByWorkosUserId, { workosUserId: user.id }),
  )

  const substantiveLength = getResumeSubstantiveLength(resume)
  const showBackButton = returnPrompt && substantiveLength >= RESUME_MIN_LENGTH

  return (
    <div className='min-h-screen bg-background'>
      <div className='container mx-auto md:py-8 md:px-4 px-0'>
        <ResumeForm
          backLink={
            showBackButton
              ? {
                  label: 'Back to Job Search',
                  search: { prompt: returnPrompt },
                  to: '/jobs',
                }
              : undefined
          }
          user={user}
        />
      </div>
    </div>
  )
}
