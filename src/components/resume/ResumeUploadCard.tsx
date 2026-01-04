'use client'

import { useAuth } from '@workos/authkit-tanstack-react-start/client'
import { useAction, useMutation } from 'convex/react'
import { AlertCircle, FileText, Loader2, Search, Upload } from 'lucide-react'
import { useCallback, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import { toast } from 'sonner'

import { api } from '../../../convex/_generated/api'
import { cn } from '../../lib/utils'
import { Button } from '../ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card'

export interface ResumeUploadResult {
  uploaded: boolean
}

interface ResumeUploadCardProps {
  onComplete: (result: ResumeUploadResult) => void
  onSkip?: () => void
  reason?: string
  pendingSearch?: string
}

export function ResumeUploadCard({
  onComplete,
  onSkip,
  reason,
  pendingSearch,
}: ResumeUploadCardProps) {
  const { user } = useAuth()
  const [isUploading, setIsUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const generateUploadUrl = useMutation(api.resumes.generateUploadUrl)
  const parseResumeFromStorage = useAction(api.resumes.parseResumeFromStorage)
  const upsertResume = useMutation(api.resumes.upsertOwn)

  const handleSkip = useCallback(() => {
    if (onSkip) {
      onSkip()
    } else {
      onComplete({ uploaded: false })
    }
  }, [onSkip, onComplete])

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      const file = acceptedFiles[0]
      if (!file) return

      if (!user?.id) {
        setError('Not authenticated')
        return
      }

      const validTypes = [
        'application/pdf',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      ]
      if (!validTypes.includes(file.type)) {
        setError('Please upload a PDF or DOCX file')
        return
      }

      if (file.size > 10 * 1024 * 1024) {
        setError('File must be smaller than 10MB')
        return
      }

      setError(null)
      setIsUploading(true)

      try {
        const uploadUrl = await generateUploadUrl()

        const response = await fetch(uploadUrl, {
          body: file,
          headers: { 'Content-Type': file.type },
          method: 'POST',
        })
        if (!response.ok) throw new Error('Upload failed')
        const { storageId } = (await response.json()) as { storageId: string }

        const extracted = await parseResumeFromStorage({
          filename: file.name,
          mimeType: file.type,
          storageId: storageId as never,
        })

        await upsertResume({
          education: extracted.education.map((edu, i) => ({
            degree: edu.degree ?? '',
            description: edu.description ?? '',
            field: edu.field ?? '',
            graduationDate: edu.graduationDate ?? '',
            id: `imported-edu-${i}`,
            institution: edu.institution ?? '',
          })),
          personalInfo: {
            email: extracted.personalInfo.email ?? '',
            linkedin: extracted.personalInfo.linkedin ?? '',
            location: extracted.personalInfo.location ?? '',
            name: extracted.personalInfo.name ?? '',
            phone: extracted.personalInfo.phone ?? '',
          },
          skills: extracted.skills ?? '',
          summary: extracted.summary ?? '',
          workExperience: extracted.workExperience.map((exp, i) => ({
            achievements: exp.achievements ?? '',
            company: exp.company ?? '',
            description: exp.description ?? '',
            endDate: exp.endDate ?? '',
            id: `imported-${i}`,
            position: exp.position ?? '',
            startDate: exp.startDate ?? '',
          })),
        })

        toast.success('Resume uploaded!', {
          description: "We'll use this to find better job matches for you.",
        })
        onComplete({ uploaded: true })
      } catch (err) {
        console.error('Resume upload error:', err)
        setError(err instanceof Error ? err.message : 'Failed to process resume. Please try again.')
      } finally {
        setIsUploading(false)
      }
    },
    [generateUploadUrl, parseResumeFromStorage, upsertResume, user?.id, onComplete],
  )

  const { getInputProps, getRootProps, isDragActive } = useDropzone({
    accept: {
      'application/pdf': ['.pdf'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
    },
    disabled: isUploading,
    maxFiles: 1,
    onDrop,
  })

  return (
    <Card className='w-full max-w-2xl'>
      <CardHeader className='text-center'>
        <CardTitle className='flex items-center justify-center gap-2'>
          <FileText className='h-5 w-5' />
          {reason ? 'Upload Your Resume' : 'Jumpstart your search with a resume'}
        </CardTitle>
        <CardDescription>
          {reason ?? "Upload your resume and we'll match you with jobs that fit your experience"}
        </CardDescription>
      </CardHeader>
      <CardContent className='space-y-4'>
        <div
          {...getRootProps()}
          className={cn(
            'cursor-pointer rounded-lg border-2 border-dashed p-8 text-center transition-colors',
            isDragActive && 'border-primary bg-primary/5',
            isUploading && 'cursor-not-allowed opacity-50',
            error && 'border-destructive',
            !isDragActive && !error && 'border-muted-foreground/25 hover:border-primary/50',
          )}
        >
          <input {...getInputProps()} />

          {isUploading ? (
            <div className='flex flex-col items-center gap-2'>
              <Loader2 className='h-8 w-8 animate-spin text-primary' />
              <p className='text-sm text-muted-foreground'>Processing your resume...</p>
            </div>
          ) : (
            <div className='flex flex-col items-center gap-2'>
              <Upload className='h-8 w-8 text-muted-foreground' />
              <p className='font-medium'>
                {isDragActive ? 'Drop your resume here' : 'Drag & drop your resume here'}
              </p>
              <p className='text-sm text-muted-foreground'>or click to browse</p>
              <p className='mt-2 text-xs text-muted-foreground'>PDF or DOCX, up to 10MB</p>
            </div>
          )}
        </div>

        {error && (
          <div className='flex items-center gap-2 text-sm text-destructive'>
            <AlertCircle className='h-4 w-4' />
            {error}
          </div>
        )}

        {pendingSearch && (
          <div className='rounded-lg border bg-muted/30 p-3'>
            <div className='flex items-start gap-2 text-sm'>
              <Search className='mt-0.5 h-4 w-4 flex-shrink-0 text-muted-foreground' />
              <div>
                <p className='text-muted-foreground'>Your search:</p>
                <p className='font-medium'>"{pendingSearch}"</p>
              </div>
            </div>
          </div>
        )}

        <div className='pt-2 text-center'>
          <Button
            className='text-muted-foreground hover:text-foreground'
            disabled={isUploading}
            onClick={handleSkip}
            size='sm'
            variant='ghost'
          >
            Skip for now →
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
