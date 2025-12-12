import { z } from 'zod'
import { zodDeepPartial } from 'zod-deep-partial'

// STRICT schema - what we store in database and what Slack/Circle expect
// All required fields must be present after merge step
export const ParsedJobSchema = z.object({
  company: z.object({
    name: z.string().describe('Company name'),
  }),
  contact: z.object({
    email: z.string().optional().describe('Contact email'),
    method: z.enum(['email', 'phone']).describe('Preferred contact method'),
    name: z.string().optional().describe('Contact person name'),
    phone: z.string().describe('Contact phone - always available from sender'),
  }),
  description: z.string().optional().describe('Job description'),
  employmentType: z
    .enum(['full-time', 'part-time', 'contract', 'internship', 'temporary'])
    .optional()
    .describe('Employment type'),
  location: z
    .object({
      city: z.string().optional(),
      countryCode: z.string().optional(),
      postalCode: z.string().optional(),
      state: z.string().optional(),
    })
    .optional()
    .describe('Job location'),
  requirements: z.array(z.string()).optional().describe('Job requirements'),
  salary: z
    .object({
      amount: z.number().optional(),
      max: z.number().optional(),
      min: z.number().optional(),
      unit: z.enum(['hr', 'day', 'week', 'month', 'year', 'job']).optional(),
    })
    .optional()
    .describe('Salary information'),
  skills: z.array(z.string()).optional().describe('Required skills'),
  title: z.string().describe('Job title'),
  workArrangement: z.enum(['remote', 'on-site', 'hybrid']).optional().describe('Work arrangement'),
})

// PERMISSIVE schema for AI extraction - all fields deeply optional
// AI may not extract everything, we merge with sender data after
export const AIExtractedJobSchema = zodDeepPartial(ParsedJobSchema)

export type ParsedJob = z.infer<typeof ParsedJobSchema>
export type AIExtractedJob = z.infer<typeof AIExtractedJobSchema>
