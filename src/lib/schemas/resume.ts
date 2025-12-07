import { z } from 'zod'

// Transform empty strings to undefined for optional fields
const optionalString = z
  .string()
  .transform(v => (v === '' ? undefined : v))
  .pipe(z.string().optional())

// URL that allows empty strings (transforms to undefined) or valid URLs
const optionalUrl = z
  .string()
  .transform(v => (v === '' ? undefined : v))
  .pipe(z.string().url('Please enter a valid URL').optional())

// Work experience entry schema
const workExperienceSchema = z.object({
  achievements: optionalString,
  company: optionalString,
  description: optionalString,
  endDate: optionalString,
  id: z.string(),
  position: optionalString,
  startDate: optionalString,
})

// Education entry schema
const educationSchema = z.object({
  degree: optionalString,
  description: optionalString,
  field: optionalString,
  graduationDate: optionalString,
  id: z.string(),
  institution: optionalString,
})

// Personal information schema
const personalInfoSchema = z.object({
  email: z.string().email('Please enter a valid email'),
  linkedin: optionalUrl,
  location: optionalString,
  name: z.string().min(1, 'Name is required'),
  phone: optionalString,
})

// Shared schema used by both client (TanStack Form) and server (Convex)
export const resumeFormSchema = z.object({
  education: z.array(educationSchema),
  personalInfo: personalInfoSchema,
  skills: optionalString,
  summary: optionalString,
  workExperience: z.array(workExperienceSchema),
})

// Extended schema for mutations that require user identification
export const resumeMutationSchema = resumeFormSchema.extend({
  workosUserId: z.string().min(1),
})

// Type exports for use throughout the app
// Use z.input for form input types (strings before transform)
// Use z.output for types after validation/transform
export type WorkExperienceInput = z.input<typeof workExperienceSchema>
export type EducationInput = z.input<typeof educationSchema>
export type WorkExperience = z.output<typeof workExperienceSchema>
export type Education = z.output<typeof educationSchema>
export type PersonalInfo = z.output<typeof personalInfoSchema>
export type ResumeFormData = z.input<typeof resumeFormSchema>
export type ResumeFormOutput = z.output<typeof resumeFormSchema>
export type ResumeMutationData = z.input<typeof resumeMutationSchema>

// Helper to create empty work experience entry (input type for forms)
export function createEmptyWorkExperience(id: string): WorkExperienceInput {
  return {
    achievements: '',
    company: '',
    description: '',
    endDate: '',
    id,
    position: '',
    startDate: '',
  }
}

// Helper to create empty education entry (input type for forms)
export function createEmptyEducation(id: string): EducationInput {
  return {
    degree: '',
    description: '',
    field: '',
    graduationDate: '',
    id,
    institution: '',
  }
}

// Default form values factory
export function createDefaultResumeFormValues(options?: {
  email?: string
  existingResume?: ResumeFormOutput | null
  firstName?: string | null
  generateId: () => string
  lastName?: string | null
}): ResumeFormData {
  const { email = '', firstName, lastName, existingResume, generateId = () => '' } = options ?? {}

  if (existingResume) {
    return {
      education: existingResume.education.length
        ? existingResume.education.map(edu => ({
            degree: edu.degree ?? '',
            description: edu.description ?? '',
            field: edu.field ?? '',
            graduationDate: edu.graduationDate ?? '',
            id: edu.id,
            institution: edu.institution ?? '',
          }))
        : [createEmptyEducation(generateId())],
      personalInfo: {
        email: existingResume.personalInfo.email ?? email,
        linkedin: existingResume.personalInfo.linkedin ?? '',
        location: existingResume.personalInfo.location ?? '',
        name: existingResume.personalInfo.name ?? '',
        phone: existingResume.personalInfo.phone ?? '',
      },
      skills: existingResume.skills ?? '',
      summary: existingResume.summary ?? '',
      workExperience: existingResume.workExperience.length
        ? existingResume.workExperience.map(exp => ({
            achievements: exp.achievements ?? '',
            company: exp.company ?? '',
            description: exp.description ?? '',
            endDate: exp.endDate ?? '',
            id: exp.id,
            position: exp.position ?? '',
            startDate: exp.startDate ?? '',
          }))
        : [createEmptyWorkExperience(generateId())],
    }
  }

  return {
    education: [createEmptyEducation(generateId())],
    personalInfo: {
      email,
      linkedin: '',
      location: '',
      name: [firstName, lastName].filter(Boolean).join(' '),
      phone: '',
    },
    skills: '',
    summary: '',
    workExperience: [createEmptyWorkExperience(generateId())],
  }
}
