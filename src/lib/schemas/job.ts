import { z } from 'zod'

export const searchJobResultSchema = z.object({
  busAccessible: z.boolean(),
  company: z.string(),
  description: z.string().nullable(),
  id: z.string(),
  isEasyApply: z.boolean(),
  isSecondChance: z.boolean(),
  isUrgent: z.boolean(),
  location: z.string().nullable(),
  railAccessible: z.boolean(),
  salary: z.string().nullable(),
  secondChanceTier: z.string().nullable(),
  shifts: z.array(z.string()),
  title: z.string(),
  transitAccessible: z.boolean(),
  url: z.string(),
})

export type SearchJobResult = z.infer<typeof searchJobResultSchema>

export const searchContextSchema = z.object({
  filters: z.object({
    busRequired: z.boolean(),
    easyApplyOnly: z.boolean(),
    railRequired: z.boolean(),
    secondChancePreferred: z.boolean(),
    secondChanceRequired: z.boolean(),
    shifts: z.array(z.string()),
    urgentOnly: z.boolean(),
  }),
  location: z.object({
    city: z.string().optional(),
    homeLocation: z.string().optional(),
    maxCommuteMinutes: z.number().optional(),
    state: z.string().optional(),
    withinCommuteZone: z.boolean(),
  }),
  query: z.string(),
  totalFound: z.number(),
})

export type SearchContext = z.infer<typeof searchContextSchema>

export const searchResultSchema = z.object({
  jobs: z.array(searchJobResultSchema),
  searchContext: searchContextSchema,
})

export type SearchResult = z.infer<typeof searchResultSchema>
