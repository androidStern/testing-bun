import { z } from 'zod';

// Transform empty strings to undefined for optional fields
const optionalString = z
  .string()
  .transform((v) => (v === '' ? undefined : v))
  .pipe(z.string().optional());

// URL that allows empty strings (transforms to undefined) or valid URLs
const optionalUrl = z
  .string()
  .transform((v) => (v === '' ? undefined : v))
  .pipe(z.string().url('Please enter a valid URL').optional());

// Work experience entry schema
const workExperienceSchema = z.object({
  id: z.string(),
  company: optionalString,
  position: optionalString,
  startDate: optionalString,
  endDate: optionalString,
  description: optionalString,
  achievements: optionalString,
});

// Education entry schema
const educationSchema = z.object({
  id: z.string(),
  institution: optionalString,
  degree: optionalString,
  field: optionalString,
  graduationDate: optionalString,
  description: optionalString,
});

// Personal information schema
const personalInfoSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Please enter a valid email'),
  phone: optionalString,
  location: optionalString,
  linkedin: optionalUrl,
});

// Shared schema used by both client (TanStack Form) and server (Convex)
export const resumeFormSchema = z.object({
  personalInfo: personalInfoSchema,
  summary: optionalString,
  workExperience: z.array(workExperienceSchema),
  education: z.array(educationSchema),
  skills: optionalString,
});

// Extended schema for mutations that require user identification
export const resumeMutationSchema = resumeFormSchema.extend({
  workosUserId: z.string().min(1),
});

// Type exports for use throughout the app
export type WorkExperience = z.infer<typeof workExperienceSchema>;
export type Education = z.infer<typeof educationSchema>;
export type PersonalInfo = z.infer<typeof personalInfoSchema>;
export type ResumeFormData = z.input<typeof resumeFormSchema>;
export type ResumeFormOutput = z.output<typeof resumeFormSchema>;
export type ResumeMutationData = z.input<typeof resumeMutationSchema>;
