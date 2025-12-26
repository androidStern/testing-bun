/**
 * Convex Client for Scraped Jobs Pipeline
 *
 * Uses HTTP API to communicate with Convex backend.
 * All mutations go through authenticated HTTP endpoints.
 */

// Job status enum matching the Convex schema
export type JobStatus = 'scraped' | 'enriching' | 'enriched' | 'indexed' | 'failed'

// Job input for insertion (after dedup passes)
export interface ConvexJobInput {
  externalId: string
  source: string
  company: string
  title: string
  description?: string
  url: string
  city?: string
  state?: string
  lat?: number
  lng?: number
  payMin?: number
  payMax?: number
  payType?: string
  jobType?: string
  isUrgent?: boolean
  isEasyApply?: boolean
  postedAt?: number
}

// Enrichment data for updating a job
export interface ConvexJobEnrichment {
  transitScore?: string
  transitDistance?: number
  busAccessible?: boolean
  railAccessible?: boolean
  shiftMorning?: boolean
  shiftAfternoon?: boolean
  shiftEvening?: boolean
  shiftOvernight?: boolean
  shiftFlexible?: boolean
  shiftSource?: string
  // Second-chance (legacy boolean - derive from tier)
  secondChance?: boolean
  // Second-chance scoring (new multi-signal)
  secondChanceScore?: number
  secondChanceTier?: 'high' | 'medium' | 'low' | 'unlikely' | 'unknown'
  secondChanceConfidence?: number
  secondChanceSignals?: string[]
  secondChanceReasoning?: string
  // Second-chance audit fields
  secondChanceDebug?: {
    llmContribution: number
    employerContribution: number
    onetContribution: number
    overrideApplied?: string
  }
  secondChanceLlmStance?: string
  secondChanceLlmReasoning?: string
  secondChanceEmployerMatch?: {
    matchType: string
    matchedName?: string
    similarity?: number
  }
  secondChanceOnetCode?: string
  secondChanceScoredAt?: number
}

// Configuration
function getConfig(): { url: string; secret: string } {
  const url = process.env.CONVEX_SITE_URL
  const secret = process.env.CONVEX_PIPELINE_SECRET

  if (!url) {
    throw new Error('CONVEX_SITE_URL environment variable is not set')
  }
  if (!secret) {
    throw new Error('CONVEX_PIPELINE_SECRET environment variable is not set')
  }

  return { secret, url }
}

// HTTP helper for Convex API calls
async function convexFetch<T>(endpoint: string, body: unknown): Promise<T> {
  const { url, secret } = getConfig()
  const fullUrl = `${url}${endpoint}`

  const response = await fetch(fullUrl, {
    body: JSON.stringify(body),
    headers: {
      'Content-Type': 'application/json',
      'X-Pipeline-Secret': secret,
    },
    method: 'POST',
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Convex API error (${response.status}): ${text}`)
  }

  return response.json() as Promise<T>
}

/**
 * Insert a new job into Convex with status "scraped"
 * Returns the Convex document ID
 */
export async function insertJob(job: ConvexJobInput): Promise<string> {
  const result = await convexFetch<{ id: string }>('/api/scraped-jobs/insert', job)
  console.log(`[Convex] Inserted job: ${job.externalId} -> ${result.id}`)
  return result.id
}

/**
 * Update job status
 * Used for status transitions and error handling
 */
export async function updateJobStatus(
  id: string,
  status: JobStatus,
  failureReason?: string,
  failureStage?: string,
): Promise<void> {
  await convexFetch('/api/scraped-jobs/status', {
    failureReason,
    failureStage,
    id,
    status,
  })
  console.log(`[Convex] Updated job ${id} status: ${status}`)
}

/**
 * Enrich a job with transit, shift, and second-chance data
 * Also updates status to "enriched"
 */
export async function enrichConvexJob(id: string, enrichment: ConvexJobEnrichment): Promise<void> {
  await convexFetch('/api/scraped-jobs/enrich', {
    id,
    ...enrichment,
  })
  console.log(`[Convex] Enriched job: ${id}`)
}

/**
 * Mark job as indexed to Typesense
 * Updates status to "indexed" and stores Typesense document ID
 */
export async function markJobIndexed(id: string, typesenseId: string): Promise<void> {
  await convexFetch('/api/scraped-jobs/indexed', {
    id,
    typesenseId,
  })
  console.log(`[Convex] Marked job indexed: ${id} -> ${typesenseId}`)
}

/**
 * Check if a job already exists by external ID and source
 * Used as dedup fallback when Redis is unavailable
 */
export async function jobExists(
  externalId: string,
  source: string,
): Promise<{ exists: boolean; id?: string }> {
  const result = await convexFetch<{ exists: boolean; job?: { _id: string } }>(
    '/api/scraped-jobs/exists',
    { externalId, source },
  )
  return {
    exists: result.exists,
    id: result.job?._id,
  }
}

/**
 * Check if Convex is configured
 * Returns true if both CONVEX_SITE_URL and CONVEX_PIPELINE_SECRET are set
 */
export function isConvexConfigured(): boolean {
  return !!(process.env.CONVEX_SITE_URL && process.env.CONVEX_PIPELINE_SECRET)
}
