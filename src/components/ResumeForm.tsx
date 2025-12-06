import { convexQuery, useConvexMutation } from '@convex-dev/react-query'
import { useForm } from '@tanstack/react-form'
import { useMutation, useSuspenseQuery } from '@tanstack/react-query'
import { useAction } from 'convex/react'
import { PlusCircle, Save, Sparkles, Trash2 } from 'lucide-react'
import { nanoid } from 'nanoid'
import { useState } from 'react'
import { z } from 'zod'

import { ResumePreview } from '@/components/ResumePreview'
import { useToast } from '@/hooks/use-toast'
import { type ResumeFormData, resumeFormSchema } from '@/lib/schemas/resume'
import { api } from '../../convex/_generated/api'

interface ResumeFormProps {
  user: {
    id: string
    email: string
    firstName?: string | null
    lastName?: string | null
  }
}

function getErrorMessage(error: unknown): string {
  if (typeof error === 'string') return error
  if (error instanceof z.ZodError) {
    const firstIssue = error.issues[0]
    if (firstIssue) return firstIssue.message
  }
  if (error && typeof error === 'object' && 'message' in error) {
    return String(error.message)
  }
  return 'Validation error'
}

export function ResumeForm({ user }: ResumeFormProps) {
  const [activeTab, setActiveTab] = useState<'form' | 'preview'>('form')
  const [isPolishing, setIsPolishing] = useState(false)
  const [polishingField, setPolishingField] = useState<string | null>(null)
  const { toast } = useToast()

  const { data: existingResume } = useSuspenseQuery(
    convexQuery(api.resumes.getByWorkosUserId, { workosUserId: user.id }),
  )

  const { mutate: saveResume, isPending: isSaving } = useMutation({
    mutationFn: useConvexMutation(api.resumes.upsert),
    onError: error => {
      toast({
        description: error.message || 'Please try again.',
        title: 'Error saving resume',
        variant: 'destructive',
      })
    },
    onSuccess: () => {
      toast({
        description: 'Your resume has been saved successfully.',
        title: 'Resume saved',
      })
    },
  })

  const polishWithAI = useAction(api.resumes.polishWithAI)

  const form = useForm<ResumeFormData>({
    defaultValues: {
      education: existingResume?.education.length
        ? existingResume.education.map(edu => ({
            degree: edu.degree ?? '',
            description: edu.description ?? '',
            field: edu.field ?? '',
            graduationDate: edu.graduationDate ?? '',
            id: edu.id,
            institution: edu.institution ?? '',
          }))
        : [
            {
              degree: '',
              description: '',
              field: '',
              graduationDate: '',
              id: nanoid(),
              institution: '',
            },
          ],
      personalInfo: {
        email: existingResume?.personalInfo.email ?? user.email,
        linkedin: existingResume?.personalInfo.linkedin ?? '',
        location: existingResume?.personalInfo.location ?? '',
        name:
          existingResume?.personalInfo.name ??
          [user.firstName, user.lastName].filter(Boolean).join(' ') ??
          '',
        phone: existingResume?.personalInfo.phone ?? '',
      },
      skills: existingResume?.skills ?? '',
      summary: existingResume?.summary ?? '',
      workExperience: existingResume?.workExperience.length
        ? existingResume.workExperience.map(exp => ({
            achievements: exp.achievements ?? '',
            company: exp.company ?? '',
            description: exp.description ?? '',
            endDate: exp.endDate ?? '',
            id: exp.id,
            position: exp.position ?? '',
            startDate: exp.startDate ?? '',
          }))
        : [
            {
              achievements: '',
              company: '',
              description: '',
              endDate: '',
              id: nanoid(),
              position: '',
              startDate: '',
            },
          ],
    },
    validators: {
      onBlur: resumeFormSchema,
      onSubmit: resumeFormSchema,
    },
  })

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

  const handleSave = () => {
    saveResume({ workosUserId: user.id, ...form.state.values })
  }

  const polishSummaryWithAI = async () => {
    if (!checkRateLimit()) {
      toast({
        description: 'You have reached your limit. Please try again later.',
        title: 'Rate limit reached',
        variant: 'destructive',
      })
      return
    }

    setIsPolishing(true)
    setPolishingField('summary')
    try {
      const values = form.state.values
      const result = await polishWithAI({
        context: {
          personalInfo: {
            location: values.personalInfo.location,
            name: values.personalInfo.name,
          },
          skills: values.skills,
          workExperience: values.workExperience.map(exp => ({
            achievements: exp.achievements,
            company: exp.company,
            description: exp.description,
            endDate: exp.endDate,
            position: exp.position,
            startDate: exp.startDate,
          })),
        },
        currentText: values.summary,
        type: 'summary',
      })
      form.setFieldValue('summary', result.polishedText)
      toast({
        description: 'Your professional summary has been enhanced.',
        title: 'Summary polished',
      })
    } catch (error) {
      console.error('Error polishing summary:', error)
      toast({
        description: 'Failed to polish summary. Please try again.',
        title: 'Error',
        variant: 'destructive',
      })
    } finally {
      setIsPolishing(false)
      setPolishingField(null)
    }
  }

  const polishWorkExperienceWithAI = async (experienceId: string, index: number) => {
    if (!checkRateLimit()) {
      toast({
        description: 'You have reached your limit. Please try again later.',
        title: 'Rate limit reached',
        variant: 'destructive',
      })
      return
    }

    const experience = form.state.values.workExperience[index]
    if (!experience) return

    setIsPolishing(true)
    setPolishingField(`work-${experienceId}`)
    try {
      const result = await polishWithAI({
        context: {
          achievements: experience.achievements,
          company: experience.company,
          position: experience.position,
        },
        currentText: experience.description,
        type: 'workExperience',
      })
      form.setFieldValue(`workExperience[${index}].description`, result.polishedText)
      toast({
        description: 'Your job description has been enhanced.',
        title: 'Description polished',
      })
    } catch (error) {
      console.error('Error polishing description:', error)
      toast({
        description: 'Failed to polish description. Please try again.',
        title: 'Error',
        variant: 'destructive',
      })
    } finally {
      setIsPolishing(false)
      setPolishingField(null)
    }
  }

  const polishEducationWithAI = async (educationId: string, index: number) => {
    if (!checkRateLimit()) {
      toast({
        description: 'You have reached your limit. Please try again later.',
        title: 'Rate limit reached',
        variant: 'destructive',
      })
      return
    }

    const education = form.state.values.education[index]
    if (!education) return

    setIsPolishing(true)
    setPolishingField(`edu-${educationId}`)
    try {
      const result = await polishWithAI({
        context: {
          degree: education.degree,
          field: education.field,
          institution: education.institution,
        },
        currentText: education.description,
        type: 'education',
      })
      form.setFieldValue(`education[${index}].description`, result.polishedText)
      toast({
        description: 'Your education description has been enhanced.',
        title: 'Description polished',
      })
    } catch (error) {
      console.error('Error polishing description:', error)
      toast({
        description: 'Failed to polish description. Please try again.',
        title: 'Error',
        variant: 'destructive',
      })
    } finally {
      setIsPolishing(false)
      setPolishingField(null)
    }
  }

  const addWorkExperience = () => {
    const current = form.state.values.workExperience
    form.setFieldValue('workExperience', [
      ...current,
      {
        achievements: '',
        company: '',
        description: '',
        endDate: '',
        id: nanoid(),
        position: '',
        startDate: '',
      },
    ])
  }

  const removeWorkExperience = (index: number) => {
    const current = form.state.values.workExperience
    if (current.length > 1) {
      form.setFieldValue(
        'workExperience',
        current.filter((_, i) => i !== index),
      )
    }
  }

  const addEducation = () => {
    const current = form.state.values.education
    form.setFieldValue('education', [
      ...current,
      { degree: '', description: '', field: '', graduationDate: '', id: nanoid(), institution: '' },
    ])
  }

  const removeEducation = (index: number) => {
    const current = form.state.values.education
    if (current.length > 1) {
      form.setFieldValue(
        'education',
        current.filter((_, i) => i !== index),
      )
    }
  }

  if (activeTab === 'preview') {
    return (
      <div className='flex-1 bg-background p-4 sm:p-6 lg:p-8'>
        <div className='max-w-4xl mx-auto'>
          <button
            className='mb-4 text-muted-foreground hover:text-foreground transition-colors'
            onClick={() => setActiveTab('form')}
            type='button'
          >
            &larr; Back to form
          </button>
          <ResumePreview formData={form.state.values} />
        </div>
      </div>
    )
  }

  return (
    <div className='flex-1 bg-background p-4 sm:p-6 lg:p-8'>
      <div className='max-w-2xl mx-auto bg-card rounded-lg shadow-sm sm:shadow-md p-4 sm:p-6 lg:p-8'>
        <h1 className='text-2xl sm:text-3xl font-bold text-card-foreground mb-2'>
          {existingResume ? 'Edit Your Resume' : 'Build Your Resume'}
        </h1>
        <p className='text-muted-foreground mb-6 sm:mb-8'>
          Create an ATS-friendly resume to help you land your next job.
        </p>

        <form
          className='space-y-6'
          onSubmit={e => {
            e.preventDefault()
            e.stopPropagation()
            handleSave()
          }}
        >
          {/* Personal Information */}
          <div>
            <h2 className='text-lg font-semibold text-foreground mb-4'>Personal Information</h2>
            <div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
              <form.Field name='personalInfo.name'>
                {field => (
                  <div>
                    <label className='block text-sm font-medium text-foreground mb-1.5'>
                      Full Name <span className='text-destructive'>*</span>
                    </label>
                    <input
                      className='bg-input text-foreground w-full px-3 py-2.5 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground'
                      onBlur={field.handleBlur}
                      onChange={e => field.handleChange(e.target.value)}
                      placeholder='John Doe'
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

              <form.Field name='personalInfo.email'>
                {field => (
                  <div>
                    <label className='block text-sm font-medium text-foreground mb-1.5'>
                      Email <span className='text-destructive'>*</span>
                    </label>
                    <input
                      className='bg-input text-foreground w-full px-3 py-2.5 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground'
                      onBlur={field.handleBlur}
                      onChange={e => field.handleChange(e.target.value)}
                      placeholder='john@example.com'
                      type='email'
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

              <form.Field name='personalInfo.phone'>
                {field => (
                  <div>
                    <label className='block text-sm font-medium text-foreground mb-1.5'>
                      Phone
                    </label>
                    <input
                      className='bg-input text-foreground w-full px-3 py-2.5 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground'
                      onBlur={field.handleBlur}
                      onChange={e => field.handleChange(e.target.value)}
                      placeholder='(123) 456-7890'
                      type='text'
                      value={field.state.value || ''}
                    />
                  </div>
                )}
              </form.Field>

              <form.Field name='personalInfo.location'>
                {field => (
                  <div>
                    <label className='block text-sm font-medium text-foreground mb-1.5'>
                      Location
                    </label>
                    <input
                      className='bg-input text-foreground w-full px-3 py-2.5 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground'
                      onBlur={field.handleBlur}
                      onChange={e => field.handleChange(e.target.value)}
                      placeholder='City, State'
                      type='text'
                      value={field.state.value || ''}
                    />
                  </div>
                )}
              </form.Field>

              <form.Field name='personalInfo.linkedin'>
                {field => (
                  <div className='sm:col-span-2'>
                    <label className='block text-sm font-medium text-foreground mb-1.5'>
                      LinkedIn
                    </label>
                    <input
                      className='bg-input text-foreground w-full px-3 py-2.5 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground'
                      onBlur={field.handleBlur}
                      onChange={e => field.handleChange(e.target.value)}
                      placeholder='linkedin.com/in/johndoe'
                      type='text'
                      value={field.state.value || ''}
                    />
                    {field.state.meta.errors.length > 0 && (
                      <p className='mt-1 text-sm text-destructive'>
                        {getErrorMessage(field.state.meta.errors[0])}
                      </p>
                    )}
                  </div>
                )}
              </form.Field>
            </div>
          </div>

          {/* Professional Summary */}
          <div>
            <div className='flex justify-between items-center mb-4'>
              <h2 className='text-lg font-semibold text-foreground'>Professional Summary</h2>
              <button
                className='text-sm text-primary hover:text-primary/80 disabled:opacity-50 transition-colors flex items-center gap-1'
                disabled={isPolishing}
                onClick={polishSummaryWithAI}
                type='button'
              >
                <Sparkles className='h-3 w-3' />
                {polishingField === 'summary' ? 'Polishing...' : 'Polish with AI'}
              </button>
            </div>
            <form.Field name='summary'>
              {field => (
                <div>
                  <textarea
                    className='bg-input text-foreground w-full px-3 py-2.5 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground resize-none'
                    onBlur={field.handleBlur}
                    onChange={e => field.handleChange(e.target.value)}
                    placeholder='Write a concise summary of your professional background...'
                    rows={4}
                    value={field.state.value || ''}
                  />
                </div>
              )}
            </form.Field>
          </div>

          {/* Work Experience */}
          <div>
            <div className='flex justify-between items-center mb-4'>
              <h2 className='text-lg font-semibold text-foreground'>Work Experience</h2>
              <button
                className='text-sm text-primary hover:text-primary/80 transition-colors flex items-center gap-1'
                onClick={addWorkExperience}
                type='button'
              >
                <PlusCircle className='h-4 w-4' />
                Add Experience
              </button>
            </div>

            <div className='space-y-6'>
              {form.state.values.workExperience.map((experience, index) => (
                <div className='p-4 border border-border rounded-lg' key={experience.id}>
                  <div className='flex justify-between items-center mb-4'>
                    <span className='text-sm font-medium text-muted-foreground'>
                      Experience {index + 1}
                    </span>
                    {form.state.values.workExperience.length > 1 && (
                      <button
                        className='text-sm text-destructive hover:text-destructive/80 transition-colors flex items-center gap-1'
                        onClick={() => removeWorkExperience(index)}
                        type='button'
                      >
                        <Trash2 className='h-3 w-3' />
                        Remove
                      </button>
                    )}
                  </div>

                  <div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
                    <form.Field name={`workExperience[${index}].company`}>
                      {field => (
                        <div>
                          <label className='block text-sm font-medium text-foreground mb-1.5'>
                            Company
                          </label>
                          <input
                            className='bg-input text-foreground w-full px-3 py-2.5 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground'
                            onBlur={field.handleBlur}
                            onChange={e => field.handleChange(e.target.value)}
                            placeholder='Company Name'
                            type='text'
                            value={field.state.value || ''}
                          />
                        </div>
                      )}
                    </form.Field>

                    <form.Field name={`workExperience[${index}].position`}>
                      {field => (
                        <div>
                          <label className='block text-sm font-medium text-foreground mb-1.5'>
                            Position
                          </label>
                          <input
                            className='bg-input text-foreground w-full px-3 py-2.5 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground'
                            onBlur={field.handleBlur}
                            onChange={e => field.handleChange(e.target.value)}
                            placeholder='Job Title'
                            type='text'
                            value={field.state.value || ''}
                          />
                        </div>
                      )}
                    </form.Field>

                    <form.Field name={`workExperience[${index}].startDate`}>
                      {field => (
                        <div>
                          <label className='block text-sm font-medium text-foreground mb-1.5'>
                            Start Date
                          </label>
                          <input
                            className='bg-input text-foreground w-full px-3 py-2.5 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground'
                            onBlur={field.handleBlur}
                            onChange={e => field.handleChange(e.target.value)}
                            placeholder='MM/YYYY'
                            type='text'
                            value={field.state.value || ''}
                          />
                        </div>
                      )}
                    </form.Field>

                    <form.Field name={`workExperience[${index}].endDate`}>
                      {field => (
                        <div>
                          <label className='block text-sm font-medium text-foreground mb-1.5'>
                            End Date
                          </label>
                          <input
                            className='bg-input text-foreground w-full px-3 py-2.5 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground'
                            onBlur={field.handleBlur}
                            onChange={e => field.handleChange(e.target.value)}
                            placeholder='MM/YYYY or Present'
                            type='text'
                            value={field.state.value || ''}
                          />
                        </div>
                      )}
                    </form.Field>

                    <div className='sm:col-span-2'>
                      <div className='flex justify-between items-center mb-1.5'>
                        <label className='block text-sm font-medium text-foreground'>
                          Description
                        </label>
                        <button
                          className='text-xs text-primary hover:text-primary/80 disabled:opacity-50 transition-colors flex items-center gap-1'
                          disabled={isPolishing}
                          onClick={() => polishWorkExperienceWithAI(experience.id, index)}
                          type='button'
                        >
                          <Sparkles className='h-3 w-3' />
                          {polishingField === `work-${experience.id}`
                            ? 'Polishing...'
                            : 'Polish with AI'}
                        </button>
                      </div>
                      <form.Field name={`workExperience[${index}].description`}>
                        {field => (
                          <textarea
                            className='bg-input text-foreground w-full px-3 py-2.5 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground resize-none'
                            onBlur={field.handleBlur}
                            onChange={e => field.handleChange(e.target.value)}
                            placeholder='Describe your role and responsibilities...'
                            rows={3}
                            value={field.state.value || ''}
                          />
                        )}
                      </form.Field>
                    </div>

                    <div className='sm:col-span-2'>
                      <label className='block text-sm font-medium text-foreground mb-1.5'>
                        Key Achievements
                      </label>
                      <form.Field name={`workExperience[${index}].achievements`}>
                        {field => (
                          <textarea
                            className='bg-input text-foreground w-full px-3 py-2.5 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground resize-none'
                            onBlur={field.handleBlur}
                            onChange={e => field.handleChange(e.target.value)}
                            placeholder='• Increased sales by 20%&#10;• Led a team of 5 developers'
                            rows={3}
                            value={field.state.value || ''}
                          />
                        )}
                      </form.Field>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Education */}
          <div>
            <div className='flex justify-between items-center mb-4'>
              <h2 className='text-lg font-semibold text-foreground'>Education</h2>
              <button
                className='text-sm text-primary hover:text-primary/80 transition-colors flex items-center gap-1'
                onClick={addEducation}
                type='button'
              >
                <PlusCircle className='h-4 w-4' />
                Add Education
              </button>
            </div>

            <div className='space-y-6'>
              {form.state.values.education.map((education, index) => (
                <div className='p-4 border border-border rounded-lg' key={education.id}>
                  <div className='flex justify-between items-center mb-4'>
                    <span className='text-sm font-medium text-muted-foreground'>
                      Education {index + 1}
                    </span>
                    {form.state.values.education.length > 1 && (
                      <button
                        className='text-sm text-destructive hover:text-destructive/80 transition-colors flex items-center gap-1'
                        onClick={() => removeEducation(index)}
                        type='button'
                      >
                        <Trash2 className='h-3 w-3' />
                        Remove
                      </button>
                    )}
                  </div>

                  <div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
                    <form.Field name={`education[${index}].institution`}>
                      {field => (
                        <div>
                          <label className='block text-sm font-medium text-foreground mb-1.5'>
                            Institution
                          </label>
                          <input
                            className='bg-input text-foreground w-full px-3 py-2.5 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground'
                            onBlur={field.handleBlur}
                            onChange={e => field.handleChange(e.target.value)}
                            placeholder='University Name'
                            type='text'
                            value={field.state.value || ''}
                          />
                        </div>
                      )}
                    </form.Field>

                    <form.Field name={`education[${index}].degree`}>
                      {field => (
                        <div>
                          <label className='block text-sm font-medium text-foreground mb-1.5'>
                            Degree
                          </label>
                          <input
                            className='bg-input text-foreground w-full px-3 py-2.5 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground'
                            onBlur={field.handleBlur}
                            onChange={e => field.handleChange(e.target.value)}
                            placeholder='Bachelor of Science'
                            type='text'
                            value={field.state.value || ''}
                          />
                        </div>
                      )}
                    </form.Field>

                    <form.Field name={`education[${index}].field`}>
                      {field => (
                        <div>
                          <label className='block text-sm font-medium text-foreground mb-1.5'>
                            Field of Study
                          </label>
                          <input
                            className='bg-input text-foreground w-full px-3 py-2.5 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground'
                            onBlur={field.handleBlur}
                            onChange={e => field.handleChange(e.target.value)}
                            placeholder='Computer Science'
                            type='text'
                            value={field.state.value || ''}
                          />
                        </div>
                      )}
                    </form.Field>

                    <form.Field name={`education[${index}].graduationDate`}>
                      {field => (
                        <div>
                          <label className='block text-sm font-medium text-foreground mb-1.5'>
                            Graduation Date
                          </label>
                          <input
                            className='bg-input text-foreground w-full px-3 py-2.5 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground'
                            onBlur={field.handleBlur}
                            onChange={e => field.handleChange(e.target.value)}
                            placeholder='MM/YYYY'
                            type='text'
                            value={field.state.value || ''}
                          />
                        </div>
                      )}
                    </form.Field>

                    <div className='sm:col-span-2'>
                      <div className='flex justify-between items-center mb-1.5'>
                        <label className='block text-sm font-medium text-foreground'>
                          Additional Information
                        </label>
                        <button
                          className='text-xs text-primary hover:text-primary/80 disabled:opacity-50 transition-colors flex items-center gap-1'
                          disabled={isPolishing}
                          onClick={() => polishEducationWithAI(education.id, index)}
                          type='button'
                        >
                          <Sparkles className='h-3 w-3' />
                          {polishingField === `edu-${education.id}`
                            ? 'Polishing...'
                            : 'Polish with AI'}
                        </button>
                      </div>
                      <form.Field name={`education[${index}].description`}>
                        {field => (
                          <textarea
                            className='bg-input text-foreground w-full px-3 py-2.5 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground resize-none'
                            onBlur={field.handleBlur}
                            onChange={e => field.handleChange(e.target.value)}
                            placeholder='Relevant coursework, honors, activities...'
                            rows={2}
                            value={field.state.value || ''}
                          />
                        )}
                      </form.Field>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Skills */}
          <div>
            <h2 className='text-lg font-semibold text-foreground mb-4'>Skills</h2>
            <form.Field name='skills'>
              {field => (
                <div>
                  <textarea
                    className='bg-input text-foreground w-full px-3 py-2.5 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground resize-none'
                    onBlur={field.handleBlur}
                    onChange={e => field.handleChange(e.target.value)}
                    placeholder='JavaScript, React, Node.js, Project Management, Team Leadership'
                    rows={3}
                    value={field.state.value || ''}
                  />
                </div>
              )}
            </form.Field>
          </div>

          {/* Actions */}
          <div className='flex flex-col-reverse sm:flex-row gap-3 pt-2'>
            <button
              className='w-full sm:w-auto bg-primary text-primary-foreground px-6 py-2.5 rounded-md hover:bg-primary/90 disabled:opacity-50 transition-colors flex items-center justify-center gap-2'
              disabled={isSaving}
              type='submit'
            >
              <Save className='h-4 w-4' />
              {isSaving ? 'Saving...' : 'Save Resume'}
            </button>
            <button
              className='w-full sm:w-auto text-muted-foreground px-6 py-2.5 hover:text-foreground transition-colors'
              onClick={() => setActiveTab('preview')}
              type='button'
            >
              Preview Resume
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
