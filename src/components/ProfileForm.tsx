import { convexQuery, useConvexMutation } from '@convex-dev/react-query'
import { useForm } from '@tanstack/react-form'
import { useMutation, useSuspenseQuery } from '@tanstack/react-query'
import type { User } from '@workos/authkit-tanstack-react-start'
import { useAction } from 'convex/react'
import { Sparkles } from 'lucide-react'
import { useState } from 'react'
import { z } from 'zod'
import { useToast } from '@/hooks/use-toast'
import { api } from '../../convex/_generated/api'
import type { ProfileFormData } from '../lib/schemas/profile'
import { profileFormSchema } from '../lib/schemas/profile'

const OFFER_OPTIONS = [
  { emoji: '🔍', value: 'To find a job' },
  { emoji: '🤝', value: 'To lend a hand' },
  { emoji: '💼', value: 'To post a job' },
  { emoji: '🚀', value: 'Entrepreneurship' },
]

interface ProfileFormProps {
  user: User
  onSuccess?: () => void
  referredByCode?: string
}

function getErrorMessage(error: unknown): string {
  if (typeof error === 'string') return error

  if (error instanceof z.ZodError) {
    // Use issues array directly - more stable across Zod versions
    const firstIssue = error.issues[0]
    if (firstIssue) {
      return firstIssue.message
    }
  }

  if (error && typeof error === 'object' && 'message' in error) {
    return String(error.message)
  }

  return 'Validation error'
}

const checkRateLimit = (): boolean => {
  const storageKey = '_resume_polish_cache'
  const maxRequests = 5
  const timeWindow = 60 * 1000

  try {
    const stored = localStorage.getItem(storageKey)
    const timestamps: number[] = stored ? JSON.parse(stored) : []
    const now = Date.now()
    const recentTimestamps = timestamps.filter(ts => now - ts < timeWindow)

    if (recentTimestamps.length >= maxRequests) {
      return false
    }

    recentTimestamps.push(now)
    localStorage.setItem(storageKey, JSON.stringify(recentTimestamps))
    return true
  } catch (error) {
    console.error('Rate limit check failed:', error)
    return true
  }
}

export function ProfileForm({ user, onSuccess, referredByCode }: ProfileFormProps) {
  const [errorDismissed, setErrorDismissed] = useState(false)
  const [isPolishing, setIsPolishing] = useState(false)
  const { toast } = useToast()
  const polishWithAI = useAction(api.resumes.polishWithAI)

  const { data: existingProfile } = useSuspenseQuery(
    convexQuery(api.profiles.getByWorkosUserId, { workosUserId: user.id }),
  )

  const {
    mutate: createProfile,
    isPending,
    isSuccess,
    error,
    isError,
  } = useMutation({
    mutationFn: useConvexMutation(api.profiles.create),
    onError: () => {
      setErrorDismissed(false)
    },
    onSuccess: () => {
      onSuccess?.()
    },
  })

  const defaultValues: ProfileFormData = {
    bio: existingProfile?.bio ?? '',
    headline: existingProfile?.headline ?? '',
    instagramUrl: existingProfile?.instagramUrl ?? '',
    linkedinUrl: existingProfile?.linkedinUrl ?? '',
    location: existingProfile?.location ?? '',
    resumeLink: existingProfile?.resumeLink ?? '',
    thingsICanOffer: existingProfile?.thingsICanOffer ?? [],
    website: existingProfile?.website ?? '',
  }

  const form = useForm({
    defaultValues,
    onSubmit: ({ value }) => {
      setErrorDismissed(false)
      createProfile({
        email: user.email,
        firstName: user.firstName ?? '',
        lastName: user.lastName ?? '',
        workosUserId: user.id,
        referredByCode,
        ...value,
      })
    },
  })

  const polishBioWithAI = async () => {
    if (!checkRateLimit()) {
      toast({
        description: 'You have reached your limit. Please try again later.',
        title: 'Rate limit reached',
        variant: 'destructive',
      })
      return
    }

    setIsPolishing(true)
    try {
      const values = form.state.values
      const result = await polishWithAI({
        context: {
          personalInfo: {
            location: values.location,
            name: `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim(),
          },
          skills: '',
          workExperience: values.headline
            ? [
                {
                  achievements: '',
                  company: '',
                  description: '',
                  endDate: '',
                  position: values.headline,
                  startDate: '',
                },
              ]
            : [],
        },
        currentText: values.bio,
        type: 'summary',
      })
      form.setFieldValue('bio', result.polishedText)
      toast({
        description: 'Your professional summary has been enhanced.',
        title: 'Summary polished',
      })
    } catch (error) {
      console.error('Error polishing bio:', error)
      toast({
        description: 'Failed to polish summary. Please try again.',
        title: 'Error',
        variant: 'destructive',
      })
    } finally {
      setIsPolishing(false)
    }
  }

  if (isSuccess) {
    return (
      <div className='flex-1 bg-background p-4 sm:p-6 lg:p-8'>
        <div className='max-w-2xl mx-auto bg-card rounded-lg shadow-sm sm:shadow-md p-6 sm:p-8 text-center'>
          <h1 className='text-2xl sm:text-3xl font-bold text-card-foreground mb-4'>
            Profile Saved!
          </h1>
          <p className='text-muted-foreground'>Your profile has been updated successfully.</p>
        </div>
      </div>
    )
  }

  return (
    <div className='flex-1 bg-background p-4 sm:p-6 lg:p-8'>
      <div className='max-w-2xl mx-auto bg-card rounded-lg shadow-sm sm:shadow-md p-4 sm:p-6 lg:p-8'>
        <h1 className='text-2xl sm:text-3xl font-bold text-card-foreground mb-2'>
          {existingProfile ? 'Edit Your Profile' : 'Complete Your Profile'}
        </h1>
        <p className='text-muted-foreground mb-6 sm:mb-8'>
          Help us personalize your experience by telling us a bit about yourself.
        </p>

        {isError && !errorDismissed && (
          <div className='mb-6 bg-destructive/10 border border-destructive/30 text-destructive px-4 py-3 rounded-md flex items-start justify-between gap-3'>
            <div className='flex-1'>
              <p className='font-medium'>Failed to save profile</p>
              <p className='text-sm mt-1 opacity-90'>
                {error?.message || 'An unexpected error occurred. Please try again.'}
              </p>
            </div>
            <button
              aria-label='Dismiss error'
              className='shrink-0 p-1 hover:bg-destructive/20 rounded transition-colors'
              onClick={() => setErrorDismissed(true)}
              type='button'
            >
              <svg className='w-4 h-4' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                <path
                  d='M6 18L18 6M6 6l12 12'
                  strokeLinecap='round'
                  strokeLinejoin='round'
                  strokeWidth={2}
                />
              </svg>
            </button>
          </div>
        )}

        <form
          className='space-y-5 sm:space-y-6'
          onSubmit={e => {
            e.preventDefault()
            e.stopPropagation()
            form.handleSubmit()
          }}
        >
          <form.Field
            name='thingsICanOffer'
            validators={{
              onBlur: ({ value }) =>
                value.length === 0 ? 'Please select at least one option' : undefined,
              onChange: ({ value }) =>
                value.length === 0 ? 'Please select at least one option' : undefined,
            }}
          >
            {field => (
              <div>
                <label className='block text-sm font-medium text-foreground mb-2'>
                  What brings you here? <span className='text-destructive'>*</span>
                </label>
                <div className='space-y-2'>
                  {OFFER_OPTIONS.map(option => (
                    <label
                      className='flex items-center gap-3 p-3 border border-border rounded-lg cursor-pointer hover:bg-accent transition-colors'
                      key={option.value}
                    >
                      <input
                        checked={field.state.value.includes(option.value)}
                        className='h-4 w-4 rounded border-border text-primary focus:ring-ring focus:ring-offset-0'
                        onBlur={field.handleBlur}
                        onChange={e => {
                          const currentValues = field.state.value
                          if (e.target.checked) {
                            field.handleChange([...currentValues, option.value])
                          } else {
                            field.handleChange(currentValues.filter(v => v !== option.value))
                          }
                        }}
                        type='checkbox'
                      />
                      <span className='text-lg'>{option.emoji}</span>
                      <span className='text-foreground'>{option.value}</span>
                    </label>
                  ))}
                </div>
                {field.state.meta.errors.length > 0 && (
                  <p className='mt-2 text-sm text-destructive'>
                    {getErrorMessage(field.state.meta.errors[0])}
                  </p>
                )}
              </div>
            )}
          </form.Field>

          <form.Field
            name='headline'
            validators={{
              onBlur: ({ value }) =>
                !value || value.trim() === ''
                  ? 'Please enter your most recent position'
                  : undefined,
              onChange: ({ value }) =>
                !value || value.trim() === ''
                  ? 'Please enter your most recent position'
                  : undefined,
            }}
          >
            {field => (
              <div>
                <label className='block text-sm font-medium text-foreground mb-1.5'>
                  Most Recent Position <span className='text-destructive'>*</span>
                </label>
                <input
                  className='bg-input text-foreground w-full px-3 py-2.5 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground'
                  onBlur={field.handleBlur}
                  onChange={e => field.handleChange(e.target.value)}
                  placeholder='e.g., Store clerk - 3+ years or Student'
                  type='text'
                  value={field.state.value}
                />
                {field.state.meta.errors.length > 0 && (
                  <p className='mt-1 text-sm text-destructive'>
                    {getErrorMessage(field.state.meta.errors[0])}
                  </p>
                )}
              </div>
            )}
          </form.Field>

          <form.Field
            name='bio'
            validators={{
              onBlur: ({ value }) =>
                !value || value.trim() === '' ? 'Please enter a professional summary' : undefined,
              onChange: ({ value }) =>
                !value || value.trim() === '' ? 'Please enter a professional summary' : undefined,
            }}
          >
            {field => (
              <div>
                <div className='flex items-center justify-between mb-1.5'>
                  <label className='block text-sm font-medium text-foreground'>
                    Professional Summary <span className='text-destructive'>*</span>
                  </label>
                  <button
                    className='flex flex-col items-center justify-center p-2 rounded-lg hover:bg-primary/10 disabled:opacity-50 transition-colors min-w-[52px]'
                    disabled={isPolishing}
                    onClick={polishBioWithAI}
                    type='button'
                  >
                    <div className='p-1.5 rounded-full bg-primary/10'>
                      <Sparkles className='h-4 w-4 text-primary' />
                    </div>
                    <span className='text-[10px] font-medium mt-1 text-primary'>
                      {isPolishing ? 'Wait...' : 'Polish'}
                    </span>
                  </button>
                </div>
                <textarea
                  className='bg-input text-foreground w-full px-3 py-2.5 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground resize-none'
                  onBlur={field.handleBlur}
                  onChange={e => field.handleChange(e.target.value)}
                  placeholder='Tell us about your background and expertise...'
                  rows={4}
                  value={field.state.value}
                />
                {field.state.meta.errors.length > 0 && (
                  <p className='mt-1 text-sm text-destructive'>
                    {getErrorMessage(field.state.meta.errors[0])}
                  </p>
                )}
              </div>
            )}
          </form.Field>

          <div className='flex flex-col-reverse sm:flex-row gap-3 pt-2'>
            <form.Subscribe
              selector={state => ({
                isSubmitting: state.isSubmitting,
                values: state.values,
              })}
            >
              {({ isSubmitting, values }) => {
                const isValid =
                  values.thingsICanOffer.length > 0 &&
                  values.headline.trim() !== '' &&
                  values.bio.trim() !== ''
                return (
                  <button
                    className='w-full sm:w-auto bg-primary text-primary-foreground px-6 py-2.5 rounded-md hover:bg-primary/90 disabled:opacity-50 transition-colors'
                    disabled={isPending || isSubmitting || !isValid}
                    type='submit'
                  >
                    {isPending || isSubmitting ? 'Saving...' : 'Save & Continue'}
                  </button>
                )
              }}
            </form.Subscribe>
          </div>
        </form>
      </div>
    </div>
  )
}
