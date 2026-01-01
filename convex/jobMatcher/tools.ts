import { createTool } from '@convex-dev/agent'
import { z } from 'zod'

import { internal } from '../_generated/api'
import { filterByIsochrone, type IsochroneData } from '../lib/geoFilter'

/**
 * Sanitized resume data returned to the LLM
 */
interface SanitizedResume {
  summary: string | null
  skills: string | null
  experience: Array<{
    position: string | null
    company: string | null
    description: string | null
    achievements: string | null
  }>
  education: Array<{
    degree: string | null
    field: string | null
    institution: string | null
  }>
}

/**
 * Sanitized preferences returned to the LLM
 */
interface SanitizedPreferences {
  hasHomeLocation: boolean
  hasTransitZones: boolean
  maxCommuteMinutes: number
  requirePublicTransit: boolean
  preferSecondChance: boolean
  requireSecondChance: boolean
  shiftPreferences: {
    morning?: boolean
    afternoon?: boolean
    evening?: boolean
    overnight?: boolean
    flexible?: boolean
  }
  transitRequirements: {
    bus?: boolean
    rail?: boolean
  }
}

/**
 * Sanitized job result returned to the LLM
 */
interface SanitizedJob {
  id: string
  title: string
  company: string
  location: string | null
  description: string | null
  salary: string | null
  isSecondChance: boolean
  secondChanceTier: string | null
  shifts: string[]
  transitAccessible: boolean
  busAccessible: boolean
  railAccessible: boolean
  isUrgent: boolean
  isEasyApply: boolean
  url: string
}

/**
 * Search context returned alongside jobs for UI display
 * This tells the UI what filters were actually applied
 */
interface SearchContext {
  query: string
  totalFound: number
  location: {
    city?: string
    state?: string
    withinCommuteZone: boolean
    maxCommuteMinutes?: number
    homeLocation?: string // User's home location string (e.g., "Miami, FL")
  }
  filters: {
    secondChanceRequired: boolean
    secondChancePreferred: boolean
    busRequired: boolean
    railRequired: boolean
    shifts: string[]
    urgentOnly: boolean
    easyApplyOnly: boolean
  }
}

/**
 * Result from searchJobs tool - includes both jobs and search context
 */
interface SearchResult {
  jobs: SanitizedJob[]
  searchContext: SearchContext
}

/**
 * Get the authenticated user's resume
 *
 * Security: Uses ctx.userId (from auth) - LLM cannot access other users' resumes
 */
export const getMyResume = createTool({
  args: z.union([z.object({}), z.null()]),
  description:
    'Get your resume including professional summary, skills, work experience, and education. Use this to understand what jobs you are qualified for.',
  handler: async (ctx): Promise<SanitizedResume | null> => {
    if (!ctx.userId) throw new Error('Not authenticated')

    const resume = await ctx.runQuery(internal.resumes.getByWorkosUserIdInternal, {
      workosUserId: ctx.userId,
    })

    if (!resume) {
      console.log('[Tool:getMyResume] No resume found')
      return null
    }

    console.log(
      `[Tool:getMyResume] skills=${!!resume.skills}, summary=${!!resume.summary}, exp=${resume.workExperience?.length ?? 0}, edu=${resume.education?.length ?? 0}`,
    )

    // Return sanitized data - no internal IDs, timestamps, or storage refs
    return {
      education: (resume.education ?? []).map(
        (edu: { degree?: string; field?: string; institution?: string }) => ({
          degree: edu.degree ?? null,
          field: edu.field ?? null,
          institution: edu.institution ?? null,
        }),
      ),
      experience: (resume.workExperience ?? []).map(
        (exp: {
          position?: string
          company?: string
          description?: string
          achievements?: string
        }) => ({
          achievements: exp.achievements ?? null,
          company: exp.company ?? null,
          description: exp.description ?? null,
          position: exp.position ?? null,
        }),
      ),
      skills: resume.skills ?? null,
      summary: resume.summary ?? null,
    }
  },
})

/**
 * Get the authenticated user's job search preferences
 *
 * Security: Uses ctx.userId (from auth) - LLM cannot access other users' preferences
 * Note: Returns whether user has isochrones, but NOT the actual isochrone data
 */
export const getMyJobPreferences = createTool({
  args: z.union([z.object({}), z.null()]),
  description:
    'Get your job search preferences including commute limits, shift preferences, and whether you prefer second-chance employers. Also tells you if you have transit zones set up.',
  handler: async (ctx): Promise<SanitizedPreferences> => {
    if (!ctx.userId) throw new Error('Not authenticated')

    // Fetch preferences and profile in parallel
    const [prefs, profile] = await Promise.all([
      ctx.runQuery(internal.jobPreferences.getByWorkosUserIdInternal, { workosUserId: ctx.userId }),
      ctx.runQuery(internal.profiles.getByWorkosUserIdInternal, { workosUserId: ctx.userId }),
    ])

    const result = {
      hasHomeLocation: !!(profile?.homeLat && profile?.homeLon),
      hasTransitZones: !!profile?.isochrones,
      maxCommuteMinutes: prefs?.maxCommuteMinutes ?? 30,
      preferSecondChance: prefs?.preferSecondChance ?? false,
      requirePublicTransit: prefs?.requirePublicTransit ?? false,
      requireSecondChance: prefs?.requireSecondChance ?? false,
      shiftPreferences: {
        afternoon: prefs?.shiftAfternoon,
        evening: prefs?.shiftEvening,
        flexible: prefs?.shiftFlexible,
        morning: prefs?.shiftMorning,
        overnight: prefs?.shiftOvernight,
      },
      transitRequirements: {
        bus: prefs?.requireBusAccessible,
        rail: prefs?.requireRailAccessible,
      },
    }

    console.log(
      `[Tool:getMyJobPreferences] home=${result.hasHomeLocation}, transit=${result.hasTransitZones}, commute=${result.maxCommuteMinutes}min`,
    )

    return result
  },
})

/**
 * Search for jobs with automatic geo-filtering based on user's isochrones
 *
 * Security:
 * - Uses ctx.userId to fetch user's isochrones (LLM never sees them)
 * - Geo-filtering happens server-side, not in LLM's context
 * - Returns sanitized job data without internal IDs or raw coordinates
 */
export const searchJobs = createTool({
  args: z.object({
    filters: z
      .object({
        bus_accessible: z.boolean().optional().describe('Require bus accessibility'),
        city: z.string().optional().describe('Filter by city name'),
        easy_apply_only: z.boolean().optional().describe('Only show easy apply jobs'),
        rail_accessible: z.boolean().optional().describe('Require rail accessibility'),
        second_chance_only: z
          .boolean()
          .optional()
          .describe('Only show second-chance/fair-chance employers'),
        shifts: z
          .array(z.enum(['morning', 'afternoon', 'evening', 'overnight', 'flexible']))
          .optional()
          .describe('Filter by shift availability'),
        state: z.string().optional().describe('Filter by state (e.g., FL, CA)'),
        urgent_only: z.boolean().optional().describe('Only show urgent hiring'),
      })
      .optional(),
    limit: z.number().min(1).max(8).default(5).describe('Number of results to return (max 8)'),
    query: z.string().describe('Search keywords: job titles, skills, company names, industries'),
  }),
  description: `Search for jobs matching keywords and filters.
Results are AUTOMATICALLY filtered by your commute zone if you have transit zones set up.
You don't need to worry about location filtering - it happens automatically based on the user's preferences.

Tips:
- Search for job titles, skills, or industries from the user's resume
- Use filters to narrow by shift times or second-chance employers
- Run multiple searches with different keywords to find diverse matches`,
  handler: async (ctx, args): Promise<SearchResult> => {
    if (!ctx.userId) throw new Error('Not authenticated')

    console.log(
      `[Tool:searchJobs] query="${args.query.substring(0, 40)}${args.query.length > 40 ? '...' : ''}", limit=${args.limit}`,
    )

    // Fetch user context (LLM never sees this)
    const [prefs, profile] = await Promise.all([
      ctx.runQuery(internal.jobPreferences.getByWorkosUserIdInternal, { workosUserId: ctx.userId }),
      ctx.runQuery(internal.profiles.getByWorkosUserIdInternal, { workosUserId: ctx.userId }),
    ])

    // Build Typesense filters from args + preferences
    const typesenseFilters: Record<string, unknown> = {}

    // Apply explicit filters from LLM
    if (args.filters) {
      if (args.filters.second_chance_only) {
        typesenseFilters.second_chance = true
      }
      if (args.filters.city) {
        typesenseFilters.city = args.filters.city
      }
      if (args.filters.state) {
        typesenseFilters.state = args.filters.state
      }
      if (args.filters.bus_accessible) {
        typesenseFilters.bus_accessible = true
      }
      if (args.filters.rail_accessible) {
        typesenseFilters.rail_accessible = true
      }
      if (args.filters.urgent_only) {
        typesenseFilters.is_urgent = true
      }
      if (args.filters.easy_apply_only) {
        typesenseFilters.is_easy_apply = true
      }
    }

    // Apply user preferences (if set) - these are implicit, not from LLM
    if (prefs?.requireSecondChance) {
      typesenseFilters.second_chance = true
    }
    if (prefs?.requireBusAccessible) {
      typesenseFilters.bus_accessible = true
    }
    if (prefs?.requireRailAccessible) {
      typesenseFilters.rail_accessible = true
    }

    // Build shift preferences array for OR filtering
    // Note: Shift preferences use OR logic - show jobs that match ANY preferred shift
    const shiftPreferences: string[] = []
    if (prefs?.shiftMorning) shiftPreferences.push('morning')
    if (prefs?.shiftAfternoon) shiftPreferences.push('afternoon')
    if (prefs?.shiftEvening) shiftPreferences.push('evening')
    if (prefs?.shiftOvernight) shiftPreferences.push('overnight')
    if (prefs?.shiftFlexible) shiftPreferences.push('flexible')

    // Add explicit shift filters from the LLM request
    if (args.filters?.shifts) {
      for (const shift of args.filters.shifts) {
        if (!shiftPreferences.includes(shift)) {
          shiftPreferences.push(shift)
        }
      }
    }

    // Build geo filter for Typesense pre-filtering (wide radius)
    let geoFilter: { lat: number; lng: number; radiusKm: number } | undefined
    if (profile?.homeLat && profile?.homeLon) {
      // Pre-filter with wide radius - we'll do precise isochrone filtering after
      geoFilter = {
        lat: profile.homeLat,
        lng: profile.homeLon,
        radiusKm: 80, // ~50 miles - catches anything potentially reachable
      }
    }

    // Log is above - details omitted to keep logs readable

    // Execute Typesense search
    const searchResults = await ctx.runAction(internal.scrapedJobsSearch.searchWithGeo, {
      filters: typesenseFilters,
      geoFilter,
      limit: args.limit * 3, // Fetch extra since we'll filter some out
      query: args.query,
      shiftPreferences: shiftPreferences.length > 0 ? shiftPreferences : undefined,
    })

    const foundCount = searchResults?.found ?? 0
    const hitsCount = searchResults?.hits?.length ?? 0

    // Define the job document type from Typesense
    interface TypesenseJobDocument {
      id: string
      title: string
      company: string
      description?: string
      location?: [number, number]
      city?: string
      state?: string
      salary_min?: number
      salary_max?: number
      salary_type?: string
      second_chance?: boolean
      second_chance_tier?: string
      shift_morning?: boolean
      shift_afternoon?: boolean
      shift_evening?: boolean
      shift_overnight?: boolean
      shift_flexible?: boolean
      bus_accessible?: boolean
      rail_accessible?: boolean
      is_urgent?: boolean
      is_easy_apply?: boolean
      url: string
    }

    // Extract hits from Typesense response - cast to proper type
    let jobs = (searchResults?.hits ?? []) as Array<{ document: TypesenseJobDocument }>

    // Apply isochrone filtering if user has transit zones and requires transit
    if (profile?.isochrones && prefs?.requirePublicTransit && profile.homeLat && profile.homeLon) {
      const maxMinutes = (prefs.maxCommuteMinutes ?? 30) as 10 | 30 | 60

      // Filter by actual isochrone polygon
      const jobsWithLocation = jobs.map(hit => ({
        ...hit,
        id: hit.document.id,
        location: hit.document.location,
      }))

      const filteredJobs = filterByIsochrone(
        jobsWithLocation,
        profile.isochrones as IsochroneData,
        maxMinutes,
      )

      jobs = filteredJobs
    }

    // Limit results
    jobs = jobs.slice(0, args.limit)

    // Format salary string
    const formatSalary = (doc: {
      salary_min?: number
      salary_max?: number
      salary_type?: string
    }): string | null => {
      if (!doc.salary_min && !doc.salary_max) return null

      const type = doc.salary_type ?? 'hourly'
      const min = doc.salary_min ? `$${doc.salary_min.toLocaleString()}` : ''
      const max = doc.salary_max ? `$${doc.salary_max.toLocaleString()}` : ''

      if (min && max && min !== max) {
        return `${min} - ${max}/${type}`
      }
      return `${min || max}/${type}`
    }

    // Extract shift types
    const extractShifts = (doc: {
      shift_morning?: boolean
      shift_afternoon?: boolean
      shift_evening?: boolean
      shift_overnight?: boolean
      shift_flexible?: boolean
    }): string[] => {
      const shifts: string[] = []
      if (doc.shift_morning) shifts.push('morning')
      if (doc.shift_afternoon) shifts.push('afternoon')
      if (doc.shift_evening) shifts.push('evening')
      if (doc.shift_overnight) shifts.push('overnight')
      if (doc.shift_flexible) shifts.push('flexible')
      return shifts
    }

    // Return sanitized results
    const sanitizedJobs = jobs.map(hit => {
      const doc = hit.document
      return {
        busAccessible: doc.bus_accessible ?? false,
        company: doc.company,
        // Truncate to 100 chars to stay within Groq's 10K TPM limit
        description: doc.description
          ? doc.description.substring(0, 100) + (doc.description.length > 100 ? '...' : '')
          : null,
        id: doc.id,
        isEasyApply: doc.is_easy_apply ?? false,
        isSecondChance: doc.second_chance ?? false,
        isUrgent: doc.is_urgent ?? false,
        location: doc.city && doc.state ? `${doc.city}, ${doc.state}` : null,
        railAccessible: doc.rail_accessible ?? false,
        salary: formatSalary(doc),
        secondChanceTier: doc.second_chance_tier ?? null,
        shifts: extractShifts(doc),
        title: doc.title,
        transitAccessible: (doc.bus_accessible || doc.rail_accessible) ?? false,
        url: doc.url,
      }
    })

    // Build search context for UI display
    const searchContext: SearchContext = {
      filters: {
        busRequired: prefs?.requireBusAccessible ?? args.filters?.bus_accessible ?? false,
        easyApplyOnly: args.filters?.easy_apply_only ?? false,
        railRequired: prefs?.requireRailAccessible ?? args.filters?.rail_accessible ?? false,
        secondChancePreferred: prefs?.preferSecondChance ?? false,
        secondChanceRequired:
          prefs?.requireSecondChance ?? args.filters?.second_chance_only ?? false,
        shifts: shiftPreferences,
        urgentOnly: args.filters?.urgent_only ?? false,
      },
      location: {
        city: args.filters?.city,
        homeLocation: profile?.location ?? undefined,
        maxCommuteMinutes: prefs?.maxCommuteMinutes,
        state: args.filters?.state,
        withinCommuteZone: !!(profile?.isochrones && prefs?.requirePublicTransit),
      },
      query: args.query,
      totalFound: foundCount,
    }

    console.log(`[Tool:searchJobs] → found=${foundCount}, returned=${sanitizedJobs.length} jobs`)

    return {
      jobs: sanitizedJobs,
      searchContext,
    }
  },
})

/**
 * Ask the user a clarifying question with quick-reply options
 *
 * Use this tool when you need to gather information from the user:
 * - What kind of work they're looking for (if no resume)
 * - What shifts work for them (if no preferences set)
 * - How far they're willing to commute (if no commute preference)
 *
 * The UI will render clickable buttons for each option.
 */
export const askQuestion = createTool({
  args: z.object({
    allowFreeText: z
      .boolean()
      .optional()
      .describe('Whether to allow the user to type their own answer (defaults to true)'),
    options: z
      .array(
        z.object({
          description: z.string().optional().describe('Additional context for the option'),
          id: z.string().describe('Unique identifier for this option'),
          label: z.string().describe('Display text for this option'),
        }),
      )
      .min(1)
      .max(5)
      .describe('2-5 quick-reply options. Each MUST have id and label properties.'),
    question: z.string().describe('The question to ask the user'),
  }),
  description: `Ask the user a clarifying question with quick-reply buttons.

IMPORTANT: Each option object MUST have exactly these properties:
- id: string (unique identifier)
- label: string (display text)
- description: string (optional, additional context)

Use this to gather missing information before searching:
- Job type preferences (if no resume)
- Shift availability (if not set)
- Commute distance (if not set)
- Location preferences

The user can click an option OR type their own answer.
After receiving their response, proceed with the job search.`,
  handler: async (ctx, args) => {
    // This tool is a passthrough - the UI handles rendering
    // The return value shows up in the tool result
    const allowFreeText = args.allowFreeText ?? true
    console.log(
      `[Tool:askQuestion] question="${args.question.substring(0, 40)}...", options=${args.options.length}, freeText=${allowFreeText}`,
    )
    return { ...args, allowFreeText }
  },
})

export const tools = {
  askQuestion,
  getMyJobPreferences,
  getMyResume,
  searchJobs,
}
