/**
 * Process Batch Function
 *
 * Triggered by batch/process event.
 * Receives a batch of jobs with details already fetched.
 * Handles: dedup → Convex insert → enrich → Convex enrich → index → Convex mark indexed
 */

import * as geocoder from '../../dedup/geocoder-mapbox.js'
import * as dedup from '../../dedup/job-dedup-enhanced.js'
import {
  type ConvexJobEnrichment,
  type ConvexJobInput,
  enrichConvexJob,
  insertJob,
  markJobIndexed,
} from '../../lib/convex'
import { enrichJob } from '../../lib/enrichment'
import { getEmployerSignal } from '../../lib/enrichment/second-chance-employer'
// Multi-signal second-chance scoring
import { analyzeJobForSecondChanceSafe } from '../../lib/enrichment/second-chance-llm'
import {
  computeSecondChanceScore,
  generateLLMSignal,
  generateOnetSignal,
  type SecondChanceScore,
} from '../../lib/enrichment/second-chance-scorer'
import type { ShiftResult } from '../../lib/enrichment/shift-extractor'
import { getRedis } from '../../lib/redis'
import { type EnrichedJob, indexJob } from '../../lib/typesense'
import type { SnagajobJob } from '../../scrapers/snagajob'
import type { TransitScore } from '../../transit-scorer'
import { loadTransitData, scoreTransitAccess } from '../../transit-scorer'
import { inngest } from '../client'

// Helper: Convert SnagajobJob to ConvexJobInput
// Note: Convex rejects null, only accepts undefined for optional fields
function toConvexInput(job: SnagajobJob, source: string): ConvexJobInput {
  return {
    city: job.city ?? undefined,
    company: job.company,
    description: job.descriptionText ?? undefined,
    externalId: job.id,
    isEasyApply: job.isEasyApply ?? undefined,
    isUrgent: job.isUrgent ?? undefined,
    jobType: job.jobType ?? undefined,
    lat: job.latitude ?? undefined,
    lng: job.longitude ?? undefined,
    payMax: job.payMax ?? undefined,
    payMin: job.payMin ?? undefined,
    payType: job.payType ?? undefined,
    postedAt: job.postedDate ? new Date(job.postedDate).getTime() : undefined,
    source,
    state: job.state ?? undefined,
    title: job.title,
    url: job.applyUrl,
  }
}

// Audit data for second-chance scoring traceability
interface SecondChanceAuditData {
  llmAnalysis?: { stance: string; reasoning: string } | null
  employerSignal?: {
    matchType: 'exact' | 'fuzzy' | 'none'
    matchedName?: string
    similarity?: number
  }
  onetCode?: string
}

// Helper: Convert enrichment results to Convex enrichment format
function toConvexEnrichment(
  shifts: ShiftResult | undefined,
  transit: TransitScore | undefined,
  secondChanceScore: SecondChanceScore | undefined,
  audit?: SecondChanceAuditData,
): ConvexJobEnrichment {
  return {
    busAccessible: transit ? transit.nearbyStops > 0 && !transit.nearbyRail : undefined,
    railAccessible: transit?.nearbyRail,
    // Second-chance (derive legacy boolean from tier)
    secondChance: secondChanceScore
      ? secondChanceScore.tier === 'high' || secondChanceScore.tier === 'medium'
      : undefined,
    secondChanceConfidence: secondChanceScore?.confidence,
    // Second-chance audit fields
    secondChanceDebug: secondChanceScore?.debug,
    secondChanceEmployerMatch: audit?.employerSignal
      ? {
          matchedName: audit.employerSignal.matchedName,
          matchType: audit.employerSignal.matchType,
          similarity: audit.employerSignal.similarity,
        }
      : undefined,
    secondChanceLlmReasoning: audit?.llmAnalysis?.reasoning,
    secondChanceLlmStance: audit?.llmAnalysis?.stance,
    secondChanceOnetCode: audit?.onetCode,
    secondChanceReasoning: secondChanceScore?.reasoning,
    secondChanceScore: secondChanceScore?.score,
    secondChanceScoredAt: secondChanceScore ? Date.now() : undefined,
    secondChanceSignals: secondChanceScore?.signals,
    secondChanceTier: secondChanceScore?.tier,
    shiftAfternoon: shifts?.afternoon,
    shiftEvening: shifts?.evening,
    shiftFlexible: shifts?.flexible,
    // Shifts
    shiftMorning: shifts?.morning,
    shiftOvernight: shifts?.overnight,
    shiftSource: shifts?.source,
    transitDistance: transit?.distanceMiles,
    // Transit
    transitScore: transit?.score,
  }
}

export const processBatch = inngest.createFunction(
  {
    concurrency: { limit: 5 },
    id: 'process-batch',
    retries: 3,
  },
  { event: 'batch/process' },
  async ({ event, step, logger }) => {
    const { jobs, source } = event.data
    logger.info(`Processing batch of ${jobs.length} jobs from ${source}`)

    // Initialize services
    await step.run('init', async () => {
      const redis = getRedis()
      const mapboxKey = process.env.MAPBOX_API_KEY
      if (!mapboxKey) throw new Error('MAPBOX_API_KEY env var is required')
      await geocoder.initialize({ apiKey: mapboxKey })
      await dedup.initialize({ geocoder: geocoder.geocode, redis })
      await loadTransitData()
    })

    // Process each job: dedup → convex insert → enrich → convex enrich → index → convex mark indexed
    const results = await step.run('process-jobs', async () => {
      let indexed = 0
      let duplicates = 0

      for (const job of jobs) {
        // Step 1: Dedup check (Redis)
        const dedupResult = await dedup.processJob({
          company: job.company,
          description: job.descriptionText || '',
          id: job.id,
          lat: job.latitude,
          lng: job.longitude,
          location: `${job.city || ''}, ${job.state || ''}`,
          title: job.title,
        })

        if (dedupResult.isDuplicate) {
          duplicates++
          continue
        }

        // Step 2: Insert to Convex
        const convexId = await insertJob(toConvexInput(job, source))

        // Step 3: Enrich (shifts + transit)
        const enrichResult = await enrichJob(job)
        const { shifts } = enrichResult
        const transit =
          job.latitude && job.longitude
            ? await scoreTransitAccess(job.latitude, job.longitude)
            : undefined

        // Step 4: Multi-signal second-chance scoring
        const llmAnalysis = await analyzeJobForSecondChanceSafe(job.descriptionText)
        const llmSignal = generateLLMSignal(llmAnalysis)
        const employerSignal = await getEmployerSignal(job.company)
        const onetSignal = generateOnetSignal(job.onetCode)
        const secondChanceScore = computeSecondChanceScore({
          employer: employerSignal,
          llm: llmSignal,
          onet: onetSignal,
        })

        // Step 5: Update Convex with enrichment data (including audit trail)
        await enrichConvexJob(
          convexId,
          toConvexEnrichment(shifts, transit, secondChanceScore, {
            employerSignal,
            llmAnalysis,
            onetCode: job.onetCode,
          }),
        )

        // Step 6: Index to Typesense
        const enrichedJob: EnrichedJob = { ...job, secondChanceScore, shifts, transit }
        await indexJob(enrichedJob, source)
        const typesenseId = `${source}-${job.id}`

        // Step 7: Mark as indexed in Convex
        await markJobIndexed(convexId, typesenseId)

        indexed++
        logger.info(`Indexed: ${job.title} at ${job.company}`)
      }

      // Record daily metrics to Redis
      const redis = getRedis()
      const today = new Date().toISOString().split('T')[0]
      const metricsKey = `dedup:metrics:${today}`
      await redis.hincrby(metricsKey, 'processed', jobs.length)
      await redis.hincrby(metricsKey, 'duplicates', duplicates)
      await redis.hincrby(metricsKey, 'indexed', indexed)
      await redis.hincrby(metricsKey, `source:${source}`, jobs.length)
      await redis.expire(metricsKey, 60 * 60 * 24 * 30) // 30 days

      return { duplicates, indexed }
    })

    logger.info(`Batch complete: ${results.indexed} indexed, ${results.duplicates} duplicates`)
    return results
  },
)
