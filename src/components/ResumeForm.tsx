import { convexQuery, useConvexMutation } from '@convex-dev/react-query'
import { useForm } from '@tanstack/react-form'
import { useMutation, useSuspenseQuery } from '@tanstack/react-query'
import { Link, useBlocker } from '@tanstack/react-router'
import { useAction, useMutation as useConvexMutationDirect } from 'convex/react'
import {
  AlertCircle,
  ArrowLeft,
  BookOpen,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  GraduationCap,
  Lightbulb,
  Mic,
  PlusCircle,
  RotateCcw,
  Save,
  Sparkles,
  Square,
  Trash2,
  Upload,
} from 'lucide-react'
import { nanoid } from 'nanoid'
import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { HeroVideoDialog } from '@/components/hero-video-dialog'
import { ResumePreview } from '@/components/ResumePreview'
import { ResumeToolbar } from '@/components/ResumeToolbar'
import { ExpandableTextarea } from '@/components/resume/expandable-textarea'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { FieldError } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type {
  EducationFromDictation,
  ResumeExtraction,
  ResumeFormData,
  SummaryFromDictation,
  WorkExperienceFromDictation,
} from '@/lib/schemas/resume'
import {
  createDefaultResumeFormValues,
  createEmptyEducation,
  createEmptyWorkExperience,
  resumeFormSchema,
} from '@/lib/schemas/resume'
import { api } from '../../convex/_generated/api'

function SectionGuide({
  learnTitle,
  tipText,
  tipTitle,
  videoSrc,
}: {
  learnTitle: string
  tipText: string
  tipTitle: string
  videoSrc: string
}) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className='mt-4 border border-dashed border-primary/30 bg-primary/5'>
      <button
        className='w-full px-4 py-3 flex items-center justify-between text-left'
        onClick={() => setExpanded(!expanded)}
        type='button'
      >
        <div className='flex items-center gap-2'>
          <GraduationCap className='h-4 w-4 text-primary' />
          <span className='text-sm font-medium text-primary'>{learnTitle}</span>
        </div>
        {expanded ? (
          <ChevronUp className='h-4 w-4 text-primary' />
        ) : (
          <ChevronDown className='h-4 w-4 text-primary' />
        )}
      </button>

      {expanded && (
        <div className='px-4 pb-4 animate-in fade-in slide-in-from-top-2'>
          <div className='flex items-start gap-3 mb-3'>
            <div className='p-2 bg-primary/10'>
              <Lightbulb className='h-4 w-4 text-primary' />
            </div>
            <div>
              <h4 className='font-medium text-sm'>{tipTitle}</h4>
              <p className='text-xs text-muted-foreground mt-1'>{tipText}</p>
            </div>
          </div>

          <HeroVideoDialog
            animationStyle='from-center'
            className='mb-3'
            thumbnailAlt={learnTitle}
            videoSrc={videoSrc}
          />

          <a className='flex items-center gap-2 text-sm text-primary hover:underline' href='#'>
            <BookOpen className='h-4 w-4' />
            View full course module
            <ExternalLink className='h-3 w-3' />
          </a>
        </div>
      )}
    </div>
  )
}

interface SectionToolbarProps {
  onDictate?: () => void
  onPolish?: () => void
  isRecording?: boolean
  isTranscribing?: boolean
  isPolishing?: boolean
  showDictate?: boolean
  showPolish?: boolean
}

function SectionToolbar({
  onDictate,
  onPolish,
  isRecording = false,
  isTranscribing = false,
  isPolishing = false,
  showDictate = true,
  showPolish = true,
}: SectionToolbarProps) {
  return (
    <div className='flex items-center gap-1'>
      {showDictate && onDictate && (
        <button
          className='flex flex-col items-center justify-center p-2 hover:bg-primary/10 disabled:opacity-50 transition-colors min-w-[52px]'
          disabled={isTranscribing}
          onClick={onDictate}
          type='button'
        >
          <div
            className={`p-1.5 rounded-full ${isRecording ? 'bg-destructive/10' : 'bg-primary/10'}`}
          >
            {isRecording ? (
              <Square className='h-4 w-4 text-destructive' />
            ) : (
              <Mic className='h-4 w-4 text-primary' />
            )}
          </div>
          <span
            className={`text-[10px] font-medium mt-1 ${isRecording ? 'text-destructive' : 'text-primary'}`}
          >
            {isRecording ? 'Stop' : isTranscribing ? 'Wait...' : 'Dictate'}
          </span>
        </button>
      )}
      {showPolish && onPolish && (
        <button
          className='flex flex-col items-center justify-center p-2 hover:bg-primary/10 disabled:opacity-50 transition-colors min-w-[52px]'
          disabled={isPolishing}
          onClick={onPolish}
          type='button'
        >
          <div className='p-1.5 rounded-full bg-primary/10'>
            <Sparkles className='h-4 w-4 text-primary' />
          </div>
          <span className='text-[10px] font-medium mt-1 text-primary'>
            {isPolishing ? 'Wait...' : 'Polish'}
          </span>
        </button>
      )}
    </div>
  )
}

interface ResumeFormProps {
  user: {
    email: string
    firstName?: string | null
    id: string
    lastName?: string | null
  }
  backLink?: {
    to: string
    search: Record<string, string | undefined>
    label: string
  }
}

type RecordingTarget =
  | { type: 'summary' }
  | { type: 'workExperience'; index: number }
  | { type: 'education'; index: number }

type TranscribedSummaryResult = {
  section: 'summary'
  summary: SummaryFromDictation['summary']
  transcript: string
}

type TranscribedWorkResult = {
  section: 'workExperience'
  transcript: string
  workExperience: WorkExperienceFromDictation['workExperience'][number]
}

type TranscribedEducationResult = {
  education: EducationFromDictation['education'][number]
  section: 'education'
  transcript: string
}

type TranscribeSectionResult =
  | TranscribedSummaryResult
  | TranscribedWorkResult
  | TranscribedEducationResult

// Helper to map extracted resume data to form format
function mapExtractedToFormData(
  extracted: ResumeExtraction,
  generateId: () => string,
): ResumeFormData {
  return {
    education:
      extracted.education.length > 0
        ? extracted.education.map(edu => ({
            degree: edu.degree ?? '',
            description: edu.description ?? '',
            field: edu.field ?? '',
            graduationDate: edu.graduationDate ?? '',
            id: generateId(),
            institution: edu.institution ?? '',
          }))
        : [createEmptyEducation(generateId())],
    personalInfo: {
      email: extracted.personalInfo.email ?? '',
      linkedin: extracted.personalInfo.linkedin ?? '',
      location: extracted.personalInfo.location ?? '',
      name: extracted.personalInfo.name ?? '',
      phone: extracted.personalInfo.phone ?? '',
    },
    skills: extracted.skills ?? '',
    summary: extracted.summary ?? '',
    workExperience:
      extracted.workExperience.length > 0
        ? extracted.workExperience.map(exp => ({
            achievements: exp.achievements ?? '',
            company: exp.company ?? '',
            description: exp.description ?? '',
            endDate: exp.endDate ?? '',
            id: generateId(),
            position: exp.position ?? '',
            startDate: exp.startDate ?? '',
          }))
        : [createEmptyWorkExperience(generateId())],
  }
}

export function ResumeForm({ user, backLink }: ResumeFormProps) {
  const [activeTab, setActiveTab] = useState<'form' | 'preview'>('form')
  const [isPolishing, setIsPolishing] = useState(false)
  const [polishingField, setPolishingField] = useState<string | null>(null)
  const [justSaved, setJustSaved] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const [isDownloading, setIsDownloading] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [isTranscribing, setIsTranscribing] = useState(false)
  const [recordingTarget, setRecordingTarget] = useState<RecordingTarget | null>(null)
  const savedTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const resumeRef = useRef<HTMLDivElement>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Array<Blob>>([])

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (savedTimeoutRef.current) {
        clearTimeout(savedTimeoutRef.current)
      }
    }
  }, [])

  const { data: existingResume } = useSuspenseQuery(
    convexQuery(api.resumes.getByWorkosUserId, { workosUserId: user.id }),
  )

  const { mutateAsync: saveResume } = useMutation({
    mutationFn: useConvexMutation(api.resumes.upsert),
    onError: error => {
      toast.error('Error saving resume', {
        description: error.message || 'Please try again.',
      })
    },
    onSuccess: () => {
      setJustSaved(true)
      savedTimeoutRef.current = setTimeout(() => setJustSaved(false), 1500)
    },
  })

  const polishWithAI = useAction(api.resumes.polishWithAI)
  const generateUploadUrl = useConvexMutationDirect(api.resumes.generateUploadUrl)
  const parseResumeFromStorage = useAction(api.resumes.parseResumeFromStorage)
  const transcribeSectionFromStorage = useAction(api.resumes.transcribeSectionFromStorage)

  const form = useForm({
    defaultValues: createDefaultResumeFormValues({
      email: user.email,
      existingResume,
      firstName: user.firstName,
      generateId: nanoid,
      lastName: user.lastName,
    }),
    onSubmit: async ({ value }) => {
      await saveResume({ workosUserId: user.id, ...value })
      // Reset form with the submitted values to clear dirty state
      // Use requestAnimationFrame to ensure the mutation has fully completed
      requestAnimationFrame(() => {
        form.reset(value)
      })
    },
    validators: {
      onSubmit: resumeFormSchema,
    },
  })

  // Block navigation when there are unsaved changes
  useBlocker({
    enableBeforeUnload: () => form.state.isDirty,
    shouldBlockFn: () => form.state.isDirty,
    withResolver: true,
  })

  const checkRateLimit = (): boolean => {
    const storageKey = '_resume_polish_cache'
    const maxRequests = 5
    const timeWindow = 60 * 1000

    try {
      const stored = localStorage.getItem(storageKey)
      const timestamps: Array<number> = stored ? JSON.parse(stored) : []
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

  const handleFileImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file type
    const validTypes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ]
    if (!validTypes.includes(file.type)) {
      toast.error('Invalid file type', {
        description: 'Please upload a PDF or DOCX file.',
      })
      return
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast.error('File too large', {
        description: 'Please upload a file smaller than 10MB.',
      })
      return
    }

    setIsImporting(true)
    try {
      // 1. Get upload URL from Convex
      console.log('[Resume Import] Step 1: Getting upload URL...')
      const uploadUrl = await generateUploadUrl()
      console.log('[Resume Import] Step 1 complete. Upload URL:', uploadUrl)

      // 2. Upload file to Convex storage
      console.log('[Resume Import] Step 2: Uploading file...', {
        name: file.name,
        size: file.size,
        type: file.type,
      })
      const uploadResponse = await fetch(uploadUrl, {
        body: file,
        headers: { 'Content-Type': file.type },
        method: 'POST',
      })
      if (!uploadResponse.ok) throw new Error('Upload failed')
      const { storageId } = (await uploadResponse.json()) as { storageId: string }
      console.log('[Resume Import] Step 2 complete. Storage ID:', storageId)

      // 3. Parse resume with AI
      console.log('[Resume Import] Step 3: Parsing resume with AI...')
      const result = await parseResumeFromStorage({
        filename: file.name,
        mimeType: file.type,
        storageId: storageId as never, // Convex ID type
      })
      console.log('[Resume Import] Step 3 complete. Extraction result:', result)

      // 4. Populate form with extracted data
      console.log('[Resume Import] Step 4: Mapping to form data...')
      const formData = mapExtractedToFormData(result, nanoid)
      console.log('[Resume Import] Step 4 complete. Form data:', formData)

      console.log('[Resume Import] Step 5: Resetting form with new data...')
      // Use setFieldValue for each field to force re-render
      form.setFieldValue('personalInfo', formData.personalInfo)
      form.setFieldValue('summary', formData.summary)
      form.setFieldValue('skills', formData.skills)
      form.setFieldValue('workExperience', formData.workExperience)
      form.setFieldValue('education', formData.education)
      console.log('[Resume Import] Step 5 complete. Form state after update:', form.state.values)

      toast.success('Resume imported', {
        description: 'Your resume has been imported and the form has been populated.',
      })
    } catch (error) {
      console.error('[Resume Import] ERROR:', error)
      toast.error('Import failed', {
        description: 'Failed to parse resume. Please try again or enter details manually.',
      })
    } finally {
      setIsImporting(false)
      // Reset file input so the same file can be selected again
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const startRecording = async (target: RecordingTarget) => {
    if (isRecording || isTranscribing) return

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      toast.error('Microphone unavailable', {
        description: 'Your browser does not support audio recording or permission is blocked.',
      })
      return
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream)
      audioChunksRef.current = []
      setRecordingTarget(target)

      recorder.ondataavailable = event => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data)
        }
      }

      recorder.onstop = async () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' })
        audioChunksRef.current = []
        stream.getTracks().forEach(track => track.stop())
        setIsRecording(false)
        await handleAudioBlob(blob, target)
      }

      mediaRecorderRef.current = recorder
      recorder.start()
      setIsRecording(true)
    } catch (error) {
      console.error('Error starting recording:', error)
      toast.error('Could not start recording', {
        description: 'Please check microphone permissions and try again.',
      })
    }
  }

  const stopRecording = () => {
    const recorder = mediaRecorderRef.current
    if (recorder && recorder.state !== 'inactive') {
      recorder.stop()
    }
  }

  const handleAudioBlob = async (blob: Blob, target: RecordingTarget) => {
    setIsTranscribing(true)
    try {
      // 1. Upload audio to Convex storage (reusing generateUploadUrl)
      const uploadUrl = await generateUploadUrl()
      const uploadResponse = await fetch(uploadUrl, {
        body: blob,
        headers: { 'Content-Type': blob.type },
        method: 'POST',
      })
      if (!uploadResponse.ok) throw new Error('Upload failed')
      const { storageId } = (await uploadResponse.json()) as { storageId: string }

      // 2. Ask Convex to transcribe + extract structured section
      const result = (await transcribeSectionFromStorage({
        mimeType: blob.type,
        section: target.type,
        storageId: storageId as never,
      })) as TranscribeSectionResult

      // 3. Merge structured data into the form, then polish text fields using existing polish logic
      if (result.section === 'summary') {
        // Polish the transcribed summary using the same logic as polishSummaryWithAI
        const values = form.state.values
        const polished = await polishWithAI({
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
          currentText: result.summary,
          type: 'summary',
        })
        form.setFieldValue('summary', polished.polishedText)
      } else if (result.section === 'workExperience' && target.type === 'workExperience') {
        const { index } = target
        const current = form.state.values.workExperience[index]
        const we = result.workExperience

        // Update structured fields first
        form.setFieldValue(`workExperience[${index}].company`, we.company ?? current.company)
        form.setFieldValue(`workExperience[${index}].position`, we.position ?? current.position)
        form.setFieldValue(`workExperience[${index}].startDate`, we.startDate ?? current.startDate)
        form.setFieldValue(`workExperience[${index}].endDate`, we.endDate ?? current.endDate)
        form.setFieldValue(
          `workExperience[${index}].achievements`,
          we.achievements ?? current.achievements,
        )

        // Polish the description using the same logic as polishWorkExperienceWithAI
        if (we.description) {
          const polished = await polishWithAI({
            context: {
              achievements: we.achievements ?? current.achievements,
              company: we.company ?? current.company,
              position: we.position ?? current.position,
            },
            currentText: we.description,
            type: 'workExperience',
          })
          form.setFieldValue(`workExperience[${index}].description`, polished.polishedText)
        } else {
          form.setFieldValue(`workExperience[${index}].description`, current.description)
        }
      } else if (result.section === 'education' && target.type === 'education') {
        const { index } = target
        const currentEdu = form.state.values.education[index]
        const edu = result.education

        // Update structured fields first
        form.setFieldValue(
          `education[${index}].institution`,
          edu.institution ?? currentEdu.institution,
        )
        form.setFieldValue(`education[${index}].degree`, edu.degree ?? currentEdu.degree)
        form.setFieldValue(`education[${index}].field`, edu.field ?? currentEdu.field)
        form.setFieldValue(
          `education[${index}].graduationDate`,
          edu.graduationDate ?? currentEdu.graduationDate,
        )

        // Polish the description using the same logic as polishEducationWithAI
        if (edu.description) {
          const polished = await polishWithAI({
            context: {
              degree: edu.degree ?? currentEdu.degree,
              field: edu.field ?? currentEdu.field,
              institution: edu.institution ?? currentEdu.institution,
            },
            currentText: edu.description,
            type: 'education',
          })
          form.setFieldValue(`education[${index}].description`, polished.polishedText)
        } else {
          form.setFieldValue(`education[${index}].description`, currentEdu.description)
        }
      }

      toast.success('Dictation captured', {
        description: 'We used your recording to fill this section. Please review and adjust.',
      })
    } catch (error) {
      console.error('Error transcribing audio:', error)
      toast.error('Dictation failed', {
        description: 'Something went wrong while transcribing. Please try again or type manually.',
      })
    } finally {
      setIsTranscribing(false)
      setRecordingTarget(null)
    }
  }

  const polishSummaryWithAI = async () => {
    if (!checkRateLimit()) {
      toast.error('Rate limit reached', {
        description: 'You have reached your limit. Please try again later.',
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
      toast.success('Summary polished', {
        description: 'Your professional summary has been enhanced.',
      })
    } catch (error) {
      console.error('Error polishing summary:', error)
      toast.error('Error', {
        description: 'Failed to polish summary. Please try again.',
      })
    } finally {
      setIsPolishing(false)
      setPolishingField(null)
    }
  }

  const polishWorkExperienceWithAI = async (experienceId: string, index: number) => {
    if (!checkRateLimit()) {
      toast.error('Rate limit reached', {
        description: 'You have reached your limit. Please try again later.',
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
      toast.success('Description polished', {
        description: 'Your job description has been enhanced.',
      })
    } catch (error) {
      console.error('Error polishing description:', error)
      toast.error('Error', {
        description: 'Failed to polish description. Please try again.',
      })
    } finally {
      setIsPolishing(false)
      setPolishingField(null)
    }
  }

  const polishEducationWithAI = async (educationId: string, index: number) => {
    if (!checkRateLimit()) {
      toast.error('Rate limit reached', {
        description: 'You have reached your limit. Please try again later.',
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
      toast.success('Description polished', {
        description: 'Your education description has been enhanced.',
      })
    } catch (error) {
      console.error('Error polishing description:', error)
      toast.error('Error', {
        description: 'Failed to polish description. Please try again.',
      })
    } finally {
      setIsPolishing(false)
      setPolishingField(null)
    }
  }

  const handleDownloadPDF = async () => {
    try {
      setIsDownloading(true)
      const { generateResumePDF } = await import('./ResumePDF')
      const blob = await generateResumePDF(form.state.values)

      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `${form.state.values.personalInfo.name || 'Resume'}.pdf`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)

      toast.success('Download complete', {
        description: 'Your resume has been downloaded as a PDF.',
      })
    } catch (error) {
      console.error('Error generating PDF:', error)
      toast.error('Download failed', {
        description: 'Failed to generate PDF. Please try again.',
      })
    } finally {
      setIsDownloading(false)
    }
  }

  const handlePrintResume = () => {
    const formData = form.state.values
    const printWindow = window.open('', '_blank')
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>${formData.personalInfo.name} - Resume</title>
            <style>
              body {
                font-family: Arial, sans-serif;
                line-height: 1.6;
                color: #333;
                max-width: 800px;
                margin: 0 auto;
                padding: 20px;
              }
              h1, h2, h3 {
                color: #111;
                margin-top: 20px;
                margin-bottom: 10px;
              }
              h1 {
                font-size: 24px;
                text-align: center;
                margin-bottom: 5px;
              }
              .contact-info {
                text-align: center;
                margin-bottom: 20px;
                font-size: 14px;
              }
              .section {
                margin-bottom: 20px;
              }
              .section-title {
                font-size: 18px;
                border-bottom: 1px solid #ddd;
                padding-bottom: 5px;
                margin-bottom: 10px;
              }
              .job-header {
                display: flex;
                justify-content: space-between;
                align-items: flex-start;
              }
              .job-title {
                font-weight: bold;
              }
              .job-date {
                white-space: nowrap;
              }
              .skills-list {
                display: flex;
                flex-wrap: wrap;
                gap: 8px;
              }
              .skill-item {
                background-color: #f5f5f5;
                padding: 4px 12px;
                border-radius: 4px;
                font-size: 14px;
              }
              ul {
                margin-top: 5px;
                padding-left: 20px;
              }
              @media print {
                body {
                  padding: 0;
                }
              }
            </style>
          </head>
          <body>
            <h1>${formData.personalInfo.name || 'Your Name'}</h1>
            <div class="contact-info">
              ${formData.personalInfo.email ? `<div>${formData.personalInfo.email}</div>` : ''}
              <div>
                ${[formData.personalInfo.phone, formData.personalInfo.location, formData.personalInfo.linkedin].filter(Boolean).join(' | ')}
              </div>
            </div>

            ${
              formData.summary
                ? `
              <div class="section">
                <h2 class="section-title">Professional Summary</h2>
                <p>${formData.summary}</p>
              </div>
            `
                : ''
            }

            ${
              formData.workExperience.some(exp => exp.company || exp.position)
                ? `
              <div class="section">
                <h2 class="section-title">Work Experience</h2>
                ${formData.workExperience
                  .map(
                    exp => `
                  <div style="margin-bottom: 15px;">
                    <div class="job-header">
                      <div>
                        ${exp.position ? `<div class="job-title">${exp.position}</div>` : ''}
                        ${exp.company ? `<div>${exp.company}</div>` : ''}
                      </div>
                      ${exp.startDate || exp.endDate ? `<div class="job-date">${exp.startDate}${exp.startDate && exp.endDate ? ' – ' : ''}${exp.endDate}</div>` : ''}
                    </div>
                    ${exp.description ? `<p style="margin-top: 5px;">${exp.description}</p>` : ''}
                    ${
                      exp.achievements
                        ? `<ul>${exp.achievements
                            .split(/\n|•/)
                            .filter(a => a.trim())
                            .map(a => `<li>${a.trim().replace(/^•\s*/, '')}</li>`)
                            .join('')}</ul>`
                        : ''
                    }
                  </div>
                `,
                  )
                  .join('')}
              </div>
            `
                : ''
            }

            ${
              formData.education.some(edu => edu.institution || edu.degree)
                ? `
              <div class="section">
                <h2 class="section-title">Education</h2>
                ${formData.education
                  .map(
                    edu => `
                  <div style="margin-bottom: 15px;">
                    <div class="job-header">
                      <div>
                        ${edu.degree && edu.field ? `<div class="job-title">${edu.degree} in ${edu.field}</div>` : edu.degree ? `<div class="job-title">${edu.degree}</div>` : edu.field ? `<div class="job-title">${edu.field}</div>` : ''}
                        ${edu.institution ? `<div>${edu.institution}</div>` : ''}
                      </div>
                      ${edu.graduationDate ? `<div class="job-date">${edu.graduationDate}</div>` : ''}
                    </div>
                    ${edu.description ? `<p style="margin-top: 5px;">${edu.description}</p>` : ''}
                  </div>
                `,
                  )
                  .join('')}
              </div>
            `
                : ''
            }

            ${
              formData.skills
                ? `
              <div class="section">
                <h2 class="section-title">Skills</h2>
                <div class="skills-list">
                  ${formData.skills
                    .split(/,|\n|•/)
                    .map(s => s.trim())
                    .filter(Boolean)
                    .map(skill => `<span class="skill-item">${skill}</span>`)
                    .join('')}
                </div>
              </div>
            `
                : ''
            }
          </body>
        </html>
      `)
      printWindow.document.close()
      printWindow.focus()
      printWindow.print()
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
    <div className='flex-1 bg-background p-0 md:p-6 lg:p-8'>
      {/* Floating Status Toolbar */}
      <form.Subscribe selector={state => [state.isDirty, state.isSubmitting, state.canSubmit]}>
        {([isDirty, isSubmitting, canSubmit]) =>
          justSaved ? (
            <div className='fixed bottom-4 left-1/2 -translate-x-1/2 w-[calc(100%-4rem)] max-w-[calc(56rem-2rem)] z-50 bg-card border border-border shadow-lg p-3 flex items-center gap-2 animate-in fade-in slide-in-from-bottom-2'>
              <CheckCircle className='h-4 w-4 flex-shrink-0 text-green-600 dark:text-green-500' />
              <span className='text-sm font-medium text-green-600 dark:text-green-500'>Saved</span>
            </div>
          ) : isDirty ? (
            <div className='fixed bottom-4 left-1/2 -translate-x-1/2 w-[calc(100%-4rem)] max-w-[calc(56rem-2rem)] z-50 bg-card border border-border shadow-lg p-3 flex items-center justify-between gap-3 animate-in fade-in slide-in-from-bottom-2'>
              <div className='flex items-center gap-2 text-amber-600 dark:text-amber-500'>
                <AlertCircle className='h-4 w-4 flex-shrink-0' />
                <span className='text-sm font-medium'>Unsaved changes</span>
              </div>
              <div className='flex items-center gap-2'>
                <Button
                  disabled={isSubmitting}
                  onClick={() => form.reset()}
                  size='sm'
                  type='button'
                  variant='ghost'
                >
                  <RotateCcw className='h-3.5 w-3.5' />
                  Discard
                </Button>
                <Button
                  disabled={!canSubmit || isSubmitting}
                  onClick={() => form.handleSubmit()}
                  size='sm'
                  type='button'
                >
                  <Save className='h-3.5 w-3.5' />
                  {isSubmitting ? 'Saving...' : 'Save'}
                </Button>
              </div>
            </div>
          ) : null
        }
      </form.Subscribe>

      <Card className='max-w-4xl mx-auto shadow-sm sm:shadow-md overflow-visible'>
        <CardContent className='p-4 sm:p-6 lg:p-8'>
          {/* Hidden file input for import */}
          <input
            accept='.pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document'
            className='hidden'
            onChange={handleFileImport}
            ref={fileInputRef}
            type='file'
          />

          {/* Sticky Resume Toolbar */}
          <ResumeToolbar
            backButton={
              backLink && (
                <Button asChild size='sm'>
                  <Link search={backLink.search} to={backLink.to}>
                    <ArrowLeft className='mr-2 h-4 w-4' />
                    {backLink.label}
                  </Link>
                </Button>
              )
            }
            isDownloading={isDownloading}
            isImporting={isImporting}
            onDownload={handleDownloadPDF}
            onImport={() => fileInputRef.current?.click()}
            onPreview={() => setActiveTab('preview')}
            onPrint={handlePrintResume}
          />

          <div className='mb-6 sm:mb-8'>
            <h1 className='text-2xl sm:text-3xl font-bold text-card-foreground mb-2'>
              {existingResume ? 'Edit Your Resume' : 'Build Your Resume'}
            </h1>
            <p className='text-muted-foreground'>
              Create an ATS-friendly resume to help you land your next job.
            </p>
          </div>

          <form
            className='space-y-6'
            onSubmit={e => {
              e.preventDefault()
              e.stopPropagation()
              form.handleSubmit()
            }}
          >
            {/* Personal Information */}
            <div>
              <h2 className='text-lg font-semibold text-foreground mb-4'>Personal Information</h2>
              <div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
                <form.Field name='personalInfo.name'>
                  {field => (
                    <div>
                      <Label>
                        Full Name <span className='text-destructive'>*</span>
                      </Label>
                      <Input
                        onBlur={field.handleBlur}
                        onChange={e => field.handleChange(e.target.value)}
                        placeholder='John Doe'
                        type='text'
                        value={field.state.value}
                      />
                      <FieldError
                        errors={field.state.meta.errors.map(e => ({
                          message:
                            typeof e === 'string'
                              ? e
                              : (e as { message?: string })?.message ?? String(e),
                        }))}
                      />
                    </div>
                  )}
                </form.Field>

                <form.Field name='personalInfo.email'>
                  {field => (
                    <div>
                      <Label>
                        Email <span className='text-destructive'>*</span>
                      </Label>
                      <Input
                        onBlur={field.handleBlur}
                        onChange={e => field.handleChange(e.target.value)}
                        placeholder='john@example.com'
                        type='email'
                        value={field.state.value}
                      />
                      <FieldError
                        errors={field.state.meta.errors.map(e => ({
                          message:
                            typeof e === 'string'
                              ? e
                              : (e as { message?: string })?.message ?? String(e),
                        }))}
                      />
                    </div>
                  )}
                </form.Field>

                <form.Field name='personalInfo.phone'>
                  {field => (
                    <div>
                      <Label>Phone</Label>
                      <Input
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
                      <Label>Location</Label>
                      <Input
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
                      <Label>LinkedIn</Label>
                      <Input
                        onBlur={field.handleBlur}
                        onChange={e => field.handleChange(e.target.value)}
                        placeholder='linkedin.com/in/johndoe'
                        type='text'
                        value={field.state.value || ''}
                      />
                      <FieldError
                        errors={field.state.meta.errors.map(e => ({
                          message:
                            typeof e === 'string'
                              ? e
                              : (e as { message?: string })?.message ?? String(e),
                        }))}
                      />
                    </div>
                  )}
                </form.Field>
              </div>
              <SectionGuide
                learnTitle='Master Your Personal Information'
                tipText='Include a professional email address and ensure your phone number is current. Adding your city and state helps recruiters understand your location without revealing your full address.'
                tipTitle='Make a Strong First Impression'
                videoSrc='https://www.youtube.com/embed/9gVN5AD5SF8'
              />
            </div>

            {/* Professional Summary */}
            <div>
              <div className='flex justify-between items-start gap-2 mb-4'>
                <h2 className='text-lg font-semibold text-foreground'>Professional Summary</h2>
                <SectionToolbar
                  isPolishing={polishingField === 'summary'}
                  isRecording={isRecording && recordingTarget?.type === 'summary'}
                  isTranscribing={isTranscribing && recordingTarget?.type === 'summary'}
                  onDictate={() => {
                    if (isRecording && recordingTarget?.type === 'summary') {
                      stopRecording()
                    } else {
                      void startRecording({ type: 'summary' })
                    }
                  }}
                  onPolish={polishSummaryWithAI}
                />
              </div>
              <form.Field name='summary'>
                {field => (
                  <ExpandableTextarea
                    modalTitle='Professional Summary'
                    onBlur={field.handleBlur}
                    onChange={field.handleChange}
                    placeholder='Write a concise summary of your professional background...'
                    rows={4}
                    value={field.state.value || ''}
                  />
                )}
              </form.Field>
              <SectionGuide
                learnTitle='Craft a Compelling Summary'
                tipText='Your summary should be 2-4 sentences highlighting your experience level, key skills, and career goals. Focus on what makes you unique and what value you bring to employers.'
                tipTitle='Hook Recruiters in 6 Seconds'
                videoSrc='https://www.youtube.com/embed/9gVN5AD5SF8'
              />
            </div>

            {/* Work Experience - Using mode="array" */}
            <div>
              <form.Field mode='array' name='workExperience'>
                {workExpField => (
                  <>
                    <div className='flex justify-between items-center mb-4'>
                      <h2 className='text-lg font-semibold text-foreground'>Work Experience</h2>
                      <button
                        className='text-sm text-primary hover:text-primary/80 transition-colors flex items-center gap-1'
                        onClick={() => workExpField.pushValue(createEmptyWorkExperience(nanoid()))}
                        type='button'
                      >
                        <PlusCircle className='h-4 w-4' />
                        Add Experience
                      </button>
                    </div>

                    <div className='space-y-6'>
                      {workExpField.state.value.map((experience, index) => (
                        <Card key={experience.id}>
                          <CardContent>
                            <div className='flex justify-between items-center mb-4'>
                              <span className='text-sm font-medium text-muted-foreground'>
                                Experience {index + 1}
                              </span>
                              {workExpField.state.value.length > 1 && (
                                <button
                                  className='text-sm text-destructive hover:text-destructive/80 transition-colors flex items-center gap-1'
                                  onClick={() => workExpField.removeValue(index)}
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
                                    <Label>Company</Label>
                                    <Input
                                      onBlur={field.handleBlur}
                                      onChange={e => field.handleChange(e.target.value)}
                                      placeholder='Company Name'
                                      type='text'
                                      value={field.state.value}
                                    />
                                  </div>
                                )}
                              </form.Field>

                              <form.Field name={`workExperience[${index}].position`}>
                                {field => (
                                  <div>
                                    <Label>Position</Label>
                                    <Input
                                      onBlur={field.handleBlur}
                                      onChange={e => field.handleChange(e.target.value)}
                                      placeholder='Job Title'
                                      type='text'
                                      value={field.state.value}
                                    />
                                  </div>
                                )}
                              </form.Field>

                              <form.Field name={`workExperience[${index}].startDate`}>
                                {field => (
                                  <div>
                                    <Label>Start Date</Label>
                                    <Input
                                      onBlur={field.handleBlur}
                                      onChange={e => field.handleChange(e.target.value)}
                                      placeholder='MM/YYYY'
                                      type='text'
                                      value={field.state.value}
                                    />
                                  </div>
                                )}
                              </form.Field>

                              <form.Field name={`workExperience[${index}].endDate`}>
                                {field => (
                                  <div>
                                    <Label>End Date</Label>
                                    <Input
                                      onBlur={field.handleBlur}
                                      onChange={e => field.handleChange(e.target.value)}
                                      placeholder='MM/YYYY or Present'
                                      type='text'
                                      value={field.state.value}
                                    />
                                  </div>
                                )}
                              </form.Field>

                              <div className='sm:col-span-2'>
                                <div className='flex justify-between items-start gap-2 mb-1.5'>
                                  <Label>Description</Label>
                                  <SectionToolbar
                                    isPolishing={polishingField === `work-${experience.id}`}
                                    isRecording={
                                      isRecording &&
                                      recordingTarget?.type === 'workExperience' &&
                                      recordingTarget.index === index
                                    }
                                    isTranscribing={
                                      isTranscribing &&
                                      recordingTarget?.type === 'workExperience' &&
                                      recordingTarget.index === index
                                    }
                                    onDictate={() => {
                                      if (
                                        isRecording &&
                                        recordingTarget?.type === 'workExperience' &&
                                        recordingTarget.index === index
                                      ) {
                                        stopRecording()
                                      } else {
                                        void startRecording({ index, type: 'workExperience' })
                                      }
                                    }}
                                    onPolish={() =>
                                      polishWorkExperienceWithAI(experience.id, index)
                                    }
                                  />
                                </div>
                                <form.Field name={`workExperience[${index}].description`}>
                                  {field => (
                                    <ExpandableTextarea
                                      modalTitle='Job Description'
                                      onBlur={field.handleBlur}
                                      onChange={field.handleChange}
                                      placeholder='Describe your role and responsibilities...'
                                      rows={3}
                                      value={field.state.value}
                                    />
                                  )}
                                </form.Field>
                              </div>

                              <div className='sm:col-span-2'>
                                <Label>Key Achievements</Label>
                                <form.Field name={`workExperience[${index}].achievements`}>
                                  {field => (
                                    <ExpandableTextarea
                                      modalTitle='Key Achievements'
                                      onBlur={field.handleBlur}
                                      onChange={field.handleChange}
                                      placeholder='• Improved customer satisfaction scores by 15%&#10;• Trained 3 new team members'
                                      rows={3}
                                      value={field.state.value}
                                    />
                                  )}
                                </form.Field>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </>
                )}
              </form.Field>
              <SectionGuide
                learnTitle='Showcase Your Experience'
                tipText='Use action verbs and quantify achievements where possible. Focus on results and impact rather than just listing responsibilities. Tailor your descriptions to match the job you are applying for.'
                tipTitle='Turn Job Duties Into Achievements'
                videoSrc='https://www.youtube.com/embed/9gVN5AD5SF8'
              />
            </div>

            {/* Education - Using mode="array" */}
            <div>
              <form.Field mode='array' name='education'>
                {eduField => (
                  <>
                    <div className='flex justify-between items-center mb-4'>
                      <h2 className='text-lg font-semibold text-foreground'>Education</h2>
                      <button
                        className='text-sm text-primary hover:text-primary/80 transition-colors flex items-center gap-1'
                        onClick={() => eduField.pushValue(createEmptyEducation(nanoid()))}
                        type='button'
                      >
                        <PlusCircle className='h-4 w-4' />
                        Add Education
                      </button>
                    </div>

                    <div className='space-y-6'>
                      {eduField.state.value.map((education, index) => (
                        <Card key={education.id}>
                          <CardContent>
                            <div className='flex justify-between items-center mb-4'>
                              <span className='text-sm font-medium text-muted-foreground'>
                                Education {index + 1}
                              </span>
                              {eduField.state.value.length > 1 && (
                                <button
                                  className='text-sm text-destructive hover:text-destructive/80 transition-colors flex items-center gap-1'
                                  onClick={() => eduField.removeValue(index)}
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
                                    <Label>Institution</Label>
                                    <Input
                                      onBlur={field.handleBlur}
                                      onChange={e => field.handleChange(e.target.value)}
                                      placeholder='School or Institution Name'
                                      type='text'
                                      value={field.state.value}
                                    />
                                  </div>
                                )}
                              </form.Field>

                              <form.Field name={`education[${index}].degree`}>
                                {field => (
                                  <div>
                                    <Label>Degree</Label>
                                    <Input
                                      onBlur={field.handleBlur}
                                      onChange={e => field.handleChange(e.target.value)}
                                      placeholder='High School Diploma, GED, Associate Degree, etc.'
                                      type='text'
                                      value={field.state.value}
                                    />
                                  </div>
                                )}
                              </form.Field>

                              <form.Field name={`education[${index}].field`}>
                                {field => (
                                  <div>
                                    <Label>Field of Study</Label>
                                    <Input
                                      onBlur={field.handleBlur}
                                      onChange={e => field.handleChange(e.target.value)}
                                      placeholder='General Studies, Business, Healthcare, etc.'
                                      type='text'
                                      value={field.state.value}
                                    />
                                  </div>
                                )}
                              </form.Field>

                              <form.Field name={`education[${index}].graduationDate`}>
                                {field => (
                                  <div>
                                    <Label>Graduation Date</Label>
                                    <Input
                                      onBlur={field.handleBlur}
                                      onChange={e => field.handleChange(e.target.value)}
                                      placeholder='MM/YYYY'
                                      type='text'
                                      value={field.state.value}
                                    />
                                  </div>
                                )}
                              </form.Field>

                              <div className='sm:col-span-2'>
                                <div className='flex justify-between items-start gap-2 mb-1.5'>
                                  <Label>Additional Information</Label>
                                  <SectionToolbar
                                    isPolishing={polishingField === `edu-${education.id}`}
                                    isRecording={
                                      isRecording &&
                                      recordingTarget?.type === 'education' &&
                                      recordingTarget.index === index
                                    }
                                    isTranscribing={
                                      isTranscribing &&
                                      recordingTarget?.type === 'education' &&
                                      recordingTarget.index === index
                                    }
                                    onDictate={() => {
                                      if (
                                        isRecording &&
                                        recordingTarget?.type === 'education' &&
                                        recordingTarget.index === index
                                      ) {
                                        stopRecording()
                                      } else {
                                        void startRecording({ index, type: 'education' })
                                      }
                                    }}
                                    onPolish={() => polishEducationWithAI(education.id, index)}
                                  />
                                </div>
                                <form.Field name={`education[${index}].description`}>
                                  {field => (
                                    <ExpandableTextarea
                                      modalTitle='Additional Information'
                                      onBlur={field.handleBlur}
                                      onChange={field.handleChange}
                                      placeholder='Relevant coursework, honors, activities...'
                                      rows={2}
                                      value={field.state.value}
                                    />
                                  )}
                                </form.Field>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </>
                )}
              </form.Field>
              <SectionGuide
                learnTitle='Highlight Your Education'
                tipText='List your most recent or relevant education first. Include honors, relevant coursework, and extracurricular activities that demonstrate skills applicable to your target role.'
                tipTitle='Education That Stands Out'
                videoSrc='https://www.youtube.com/embed/9gVN5AD5SF8'
              />
            </div>

            {/* Skills */}
            <div>
              <h2 className='text-lg font-semibold text-foreground mb-4'>Skills</h2>
              <form.Field name='skills'>
                {field => (
                  <ExpandableTextarea
                    modalTitle='Skills'
                    onBlur={field.handleBlur}
                    onChange={field.handleChange}
                    placeholder='Customer Service, Microsoft Office, Communication, Problem Solving, Time Management'
                    rows={3}
                    value={field.state.value || ''}
                  />
                )}
              </form.Field>
              <SectionGuide
                learnTitle='Optimize Your Skills Section'
                tipText='Include a mix of hard and soft skills relevant to your target role. Use keywords from job descriptions to help pass ATS screening. Group similar skills together for better readability.'
                tipTitle='Skills That Get You Noticed'
                videoSrc='https://www.youtube.com/embed/9gVN5AD5SF8'
              />
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
