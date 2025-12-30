import { z } from 'zod'

export const jobMatchSchema = z.object({
  id: z.string(),
  title: z.string(),
  company: z.string(),
  location: z.string().nullable(),
  matchReason: z.string(),
  highlights: z.array(z.string()),
  salary: z.string().nullable(),
  isSecondChance: z.boolean(),
  shifts: z.array(z.string()),
  url: z.string(),
})

export const jobResultsSchema = z.object({
  summary: z.string(),
  jobs: z.array(jobMatchSchema),
  suggestions: z.array(z.string()).optional(),
})

export type JobMatch = z.infer<typeof jobMatchSchema>
export type JobResults = z.infer<typeof jobResultsSchema>
