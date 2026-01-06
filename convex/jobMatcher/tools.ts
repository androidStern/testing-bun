import { createTool } from '@convex-dev/agent'
import { jsonSchema, tool } from 'ai'
import { z } from 'zod'

import { internal } from '../_generated/api'
import { filterByIsochrone, type IsochroneData } from '../lib/geoFilter'

import TODOWRITE_DESCRIPTION from './todowrite.txt'

/**
 * Schema for no-arg tools that works across providers.
 * - OpenAI requires type: "object" in JSON Schema
 * - Kimi sometimes returns null for empty args
 *
 * Uses jsonSchema() to separate API schema from validation logic.
 */
const noArgsSchema = jsonSchema<Record<string, never>>(
  { properties: {}, type: 'object' },
  {
    validate: (value: unknown) => {
      if (
        value === null ||
        value === undefined ||
        (typeof value === 'object' && Object.keys(value as object).length === 0)
      ) {
        return { success: true, value: {} as Record<string, never> }
      }
      return { error: new Error('Expected null or empty object'), success: false }
    },
  },
)

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
  args: noArgsSchema,
  description:
    'Refresh resume data. RARELY NEEDED - resume is already in <user-context>. Only call if user says they just updated their resume.',
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
  args: noArgsSchema,
  description:
    'Refresh preferences data. RARELY NEEDED - preferences are already in <user-context>. Only call if user says they just updated their preferences.',
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

RULES:
- Only search when you have: (A) a job direction, AND (B) location is set OR user accepts broad results.
- One searchJobs call per turn is preferred. If you need multiple searches, do them in separate turns.
- Results are AUTOMATICALLY filtered by commute zone if transit zones are set up.
- The UI renders job cards - do NOT restate job details in your text response.

After calling searchJobs:
- Use askQuestion with purpose="post_search" to offer next steps (refine/pivot/apply).
- Summarize patterns in the preamble, not individual jobs.`,
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

    // Filter out already reviewed jobs
    const reviewedJobIds = await ctx.runQuery(internal.jobReviews.getReviewedJobIdsInternal, {
      workosUserId: ctx.userId,
    })
    const reviewedIdsSet = new Set(reviewedJobIds)
    jobs = jobs.filter(hit => !reviewedIdsSet.has(hit.document.id))

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
 * UI tool for asking the user a question with clickable options.
 * NO execute function - stops execution and waits for user input via submitToolResult.
 */
export const askQuestion = tool({
  description: `Ask the user ONE question with clickable options.

RULES:
- Only ONE askQuestion per turn.
- If askQuestion is used, it must be the FINAL tool call. STOP after calling.
- If combining with searchJobs, set purpose="post_search" and call askQuestion AFTER searchJobs.

PURPOSE VALUES:
- "discovery": Figuring out what direction they want (job type, preferences)
- "post_search": After showing job results, offering next steps (refine/pivot/apply)
- "application": Helping them apply to a specific job
- "other": Anything else

PREAMBLE (for post_search):
Use preamble to summarize patterns from search results. Examples:
- "I found mostly warehouse and forklift roles, with pay around $16-20/hr."
- "These jobs are all within your transit zone, but evening shifts dominate."
Do NOT repeat individual job details - the UI already shows job cards.

The UI displays preamble (if provided) above the question and options.`,
  inputSchema: z.object({
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
      .max(8)
      .describe('2-8 quick-reply options. Each MUST have id and label properties.'),
    preamble: z
      .string()
      .max(800)
      .optional()
      .describe(
        'Short context shown above the question. For post_search: summarize patterns only (role mix, pay range, shift mix). Never rewrite job card details.',
      ),
    purpose: z
      .enum(['discovery', 'post_search', 'application', 'other'])
      .optional()
      .describe(
        'Why you are asking: discovery (figuring out direction), post_search (after showing results), application (helping apply), other',
      ),
    question: z.string().max(220).describe('The question to ask the user'),
  }),
  // NO execute function - waits for user input
})

/**
 * UI tool for collecting user's location and transport preferences.
 * NO execute function - stops execution and waits for user input via submitToolResult.
 */
export const collectLocation = tool({
  description: `Show location setup UI to collect user's home location and transport preferences.

RULES:
- Only call if <user-context> shows "location_ready: NO".
- If called, it must be the FINAL tool call. STOP after calling.
- Do NOT call other tools after this.
- Do NOT write text after calling this - the UI handles everything.

The UI collects: home location, transport mode (car/transit/flexible), max commute time.
User can skip, resulting in no geo filtering.`,
  inputSchema: z.object({
    reason: z.string().describe('Why we need their location (shown to user)'),
  }),
})

export const collectResume = tool({
  description: `Show resume upload UI when user explicitly asks to upload a resume.

RULES:
- Only call when user explicitly requests to upload (e.g., "I want to upload my resume", "Yes, I can upload one").
- Do NOT call proactively to gate the user.
- If called, it must be the FINAL tool call. STOP after calling.
- Do NOT write text after calling this - the UI handles everything.

The UI allows PDF/DOCX upload with drag-and-drop. User can skip if they change their mind.
After upload, the resume is automatically included in the next turn's <user-context>.`,
  inputSchema: z.object({
    reason: z.string().describe('Why uploading helps (shown as card description)'),
  }),
})

/**
 * Silently save user preferences discovered during conversation.
 * This tool executes immediately (no UI) and writes to jobPreferences.
 */
const SHIFT_FIELDS = [
  'shiftMorning',
  'shiftAfternoon',
  'shiftEvening',
  'shiftOvernight',
  'shiftFlexible',
] as const

export const savePreference = createTool({
  args: z.object({
    clearOtherShifts: z
      .boolean()
      .optional()
      .describe(
        'Set true when user says "only", "just", or implies exclusivity. Clears all shifts not explicitly set to true.',
      ),
    maxCommuteMinutes: z
      .union([z.literal(10), z.literal(30), z.literal(60)])
      .optional()
      .describe('Maximum commute time in minutes'),
    preferSecondChance: z.boolean().optional().describe('Prioritize fair-chance employers'),
    requirePublicTransit: z.boolean().optional().describe('Must be accessible by public transit'),
    requireSecondChance: z.boolean().optional().describe('Only show fair-chance employers'),
    shiftAfternoon: z.boolean().optional().describe('Afternoon shift (12pm-6pm)'),
    shiftEvening: z.boolean().optional().describe('Evening shift (6pm-12am)'),
    shiftFlexible: z.boolean().optional().describe('Flexible/any shift'),
    shiftMorning: z.boolean().optional().describe('Morning shift (6am-12pm)'),
    shiftOvernight: z.boolean().optional().describe('Overnight shift (12am-6am)'),
  }),
  description: `Silently save user preferences discovered during conversation.

Use when the user STATES a preference (don't ask again, just save):
- "I can only work mornings" -> savePreference({ shiftMorning: true, clearOtherShifts: true })
- "I can also work evenings" -> savePreference({ shiftEvening: true })
- "I take the bus" -> savePreference({ requirePublicTransit: true })
- "I have a record" -> savePreference({ preferSecondChance: true })
- "30 minute commute max" -> savePreference({ maxCommuteMinutes: 30 })

IMPORTANT - clearOtherShifts:
- Set clearOtherShifts: true when user says "only", "just", or "can't work X" (exclusive intent)
- Leave it off when user says "also", "and", or is adding to existing preferences (additive intent)

RULES:
- Only save what user explicitly mentioned
- Can set multiple fields at once
- Runs silently - no UI, but top bar updates immediately
- Can be called alongside other tools (not interactive)
- Do NOT use this for job type/industry preferences (those aren't saved)`,
  handler: async (ctx, args) => {
    if (!ctx.userId) throw new Error('Not authenticated')

    const { clearOtherShifts, ...prefArgs } = args
    const updates: Record<string, unknown> = {}

    for (const [key, value] of Object.entries(prefArgs)) {
      if (value !== undefined) {
        updates[key] = value
      }
    }

    if (clearOtherShifts) {
      for (const field of SHIFT_FIELDS) {
        if (updates[field] === undefined) {
          updates[field] = false
        }
      }
    }

    if (Object.keys(updates).length === 0) {
      console.log('[Tool:savePreference] No preferences to save')
      return { reason: 'no_values', saved: false }
    }

    console.log(
      `[Tool:savePreference] Saving: ${Object.keys(updates).join(', ')}${clearOtherShifts ? ' (exclusive)' : ''}`,
    )

    await ctx.runMutation(internal.jobPreferences.upsertInternal, {
      workosUserId: ctx.userId,
      ...updates,
    })

    return { fields: Object.keys(updates), saved: true }
  },
})

/**
 * UI tool for collecting specific preference with deterministic options.
 * NO execute function - stops execution and waits for user input via submitToolResult.
 */
export const askPreference = tool({
  description: `Ask user to select a specific preference using a deterministic form.

Use when you NEED to ask (user hasn't stated preference):
- Need shift info -> askPreference({ preference: "shift" })
- Need commute tolerance -> askPreference({ preference: "commute" })
- Need fair-chance preference -> askPreference({ preference: "fairChance" })

RULES:
- Only ONE askPreference per turn
- Must be FINAL tool call - STOP after calling
- Do NOT use if user already stated the preference (use savePreference instead)
- Do NOT use askQuestion for shift/commute/fairChance (use this tool)

The UI shows a hardcoded form matching our database schema. Selections are saved automatically.`,
  inputSchema: z.object({
    context: z
      .string()
      .max(200)
      .optional()
      .describe('Brief context explaining why you need this (shown to user)'),
    preference: z.enum(['shift', 'commute', 'fairChance']).describe('Which preference to collect'),
  }),
})

export const todoWrite = createTool({
  args: z.object({
    todos: z
      .array(
        z.object({
          content: z.string().describe('Brief description of the task (3-8 words)'),
          id: z.string().describe('Unique identifier for the todo item'),
          priority: z.enum(['high', 'medium', 'low']).describe('Priority: high, medium, low'),
          status: z
            .enum(['pending', 'in_progress', 'completed', 'cancelled'])
            .describe('Current status: pending, in_progress, completed, cancelled'),
        }),
      )
      .describe('The complete updated todo list'),
  }),
  description: TODOWRITE_DESCRIPTION,
  handler: async (ctx, args) => {
    if (!ctx.threadId) throw new Error('No thread context')

    await ctx.runMutation(internal.jobMatcher.plan.updatePlan, {
      threadId: ctx.threadId,
      todos: args.todos,
    })

    const remaining = args.todos.filter(t => t.status !== 'completed').length
    console.log(`[Tool:todoWrite] Updated plan: ${remaining} remaining of ${args.todos.length}`)

    return {
      remaining,
      total: args.todos.length,
      updated: true,
    }
  },
})

interface TodoItem {
  id: string
  content: string
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled'
  priority: 'high' | 'medium' | 'low'
}

export const todoRead = createTool({
  args: noArgsSchema,
  description:
    'Read your current todo list to see what tasks are pending. Use this if you need to check your plan status.',
  handler: async (ctx): Promise<TodoItem[]> => {
    if (!ctx.threadId) throw new Error('No thread context')

    const plan: TodoItem[] | null = await ctx.runQuery(internal.jobMatcher.plan.getPlanInternal, {
      threadId: ctx.threadId,
    })

    console.log(`[Tool:todoRead] Read plan: ${plan?.length ?? 0} todos`)
    return plan ?? []
  },
})

export const tools = {
  askPreference,
  askQuestion,
  collectLocation,
  collectResume,
  getMyJobPreferences,
  getMyResume,
  savePreference,
  searchJobs,
  todoRead,
  todoWrite,
}
