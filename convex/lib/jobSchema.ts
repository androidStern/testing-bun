import { z } from 'zod';

// Single source of truth for parsed job schema
export const ParsedJobSchema = z.object({
  title: z.string().describe('Job title'),
  company: z.object({
    name: z.string().describe('Company name'),
  }),
  description: z.string().optional().describe('Job description'),
  location: z
    .object({
      city: z.string().optional(),
      state: z.string().optional(),
      postalCode: z.string().optional(),
      countryCode: z.string().optional(),
    })
    .optional()
    .describe('Job location'),
  workArrangement: z
    .enum(['remote', 'on-site', 'hybrid'])
    .describe('Work arrangement'),
  employmentType: z
    .enum(['full-time', 'part-time', 'contract', 'internship', 'temporary'])
    .optional()
    .describe('Employment type'),
  salary: z
    .object({
      min: z.number().optional(),
      max: z.number().optional(),
      amount: z.number().optional(),
      unit: z.enum(['hr', 'day', 'week', 'month', 'year']),
    })
    .optional()
    .describe('Salary information'),
  skills: z.array(z.string()).optional().describe('Required skills'),
  requirements: z.array(z.string()).optional().describe('Job requirements'),
  contact: z.object({
    name: z.string().describe('Contact person name'),
    method: z.enum(['email', 'phone']).describe('Preferred contact method'),
    email: z.string().optional().describe('Contact email'),
    phone: z.string().optional().describe('Contact phone'),
  }),
});

export type ParsedJob = z.infer<typeof ParsedJobSchema>;
