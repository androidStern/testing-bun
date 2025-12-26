/**
 * Scraped Jobs - Mutations and Queries
 *
 * Handles jobs scraped from external job boards (Snagajob, Indeed, etc.)
 * Called from the scrape-jobs pipeline via HTTP API.
 *
 * Note: The Typesense search action is in scrapedJobsSearch.ts (requires Node.js runtime)
 */

import { v } from 'convex/values'
import { internal } from './_generated/api'
import type { Id } from './_generated/dataModel'
import { internalMutation, internalQuery } from './_generated/server'
import { adminAction, adminQuery } from './functions'

// Status type for reuse
const statusValidator = v.union(
  v.literal('scraped'),
  v.literal('enriching'),
  v.literal('enriched'),
  v.literal('indexed'),
  v.literal('failed'),
)

// Scraped job document validator for return types
const scrapedJobDocValidator = v.object({
  _creationTime: v.number(),
  _id: v.id('scrapedJobs'),
  busAccessible: v.optional(v.boolean()),
  // Location
  city: v.optional(v.string()),
  // Core job data
  company: v.string(),
  description: v.optional(v.string()),
  enrichedAt: v.optional(v.number()),
  // External identification
  externalId: v.string(),
  // Error tracking
  failureReason: v.optional(v.string()),
  failureStage: v.optional(v.string()),
  indexedAt: v.optional(v.number()),
  isEasyApply: v.optional(v.boolean()),
  // Job metadata
  isUrgent: v.optional(v.boolean()),
  lat: v.optional(v.float64()),
  lng: v.optional(v.float64()),
  payMax: v.optional(v.float64()),
  // Salary
  payMin: v.optional(v.float64()),
  payType: v.optional(v.string()),
  postedAt: v.optional(v.number()),
  railAccessible: v.optional(v.boolean()),
  // Pipeline timestamps
  scrapedAt: v.number(),
  // Enrichment: Second-chance
  secondChance: v.optional(v.boolean()),
  shiftAfternoon: v.optional(v.boolean()),
  shiftEvening: v.optional(v.boolean()),
  shiftFlexible: v.optional(v.boolean()),
  // Enrichment: Shifts
  shiftMorning: v.optional(v.boolean()),
  shiftOvernight: v.optional(v.boolean()),
  shiftSource: v.optional(v.string()),
  source: v.string(),
  state: v.optional(v.string()),
  // Pipeline status tracking
  status: statusValidator,
  title: v.string(),
  transitDistance: v.optional(v.float64()),
  // Enrichment: Transit
  transitScore: v.optional(v.string()),
  // Typesense reference
  typesenseId: v.optional(v.string()),
  url: v.string(),
})

// ============================================================================
// Mutations
// ============================================================================

/**
 * Insert a new scraped job with status "scraped"
 * Called immediately after dedup passes in the pipeline
 */
export const insert = internalMutation({
  args: {
    city: v.optional(v.string()),
    company: v.string(),
    description: v.optional(v.string()),
    externalId: v.string(),
    isEasyApply: v.optional(v.boolean()),
    isUrgent: v.optional(v.boolean()),
    lat: v.optional(v.float64()),
    lng: v.optional(v.float64()),
    payMax: v.optional(v.float64()),
    payMin: v.optional(v.float64()),
    payType: v.optional(v.string()),
    postedAt: v.optional(v.number()),
    source: v.string(),
    state: v.optional(v.string()),
    title: v.string(),
    url: v.string(),
  },
  handler: async (ctx, args) => {
    const id = await ctx.db.insert('scrapedJobs', {
      ...args,
      scrapedAt: Date.now(),
      status: 'scraped',
    })
    return id
  },
  returns: v.id('scrapedJobs'),
})

/**
 * Update job status
 * Used for status transitions and error handling
 */
export const updateStatus = internalMutation({
  args: {
    failureReason: v.optional(v.string()),
    failureStage: v.optional(v.string()),
    id: v.id('scrapedJobs'),
    status: statusValidator,
  },
  handler: async (ctx, args) => {
    const { id, status, failureReason, failureStage } = args
    const updates: Record<string, unknown> = { status }

    if (failureReason !== undefined) updates.failureReason = failureReason
    if (failureStage !== undefined) updates.failureStage = failureStage

    await ctx.db.patch(id, updates)
  },
  returns: v.null(),
})

/**
 * Add enrichment data to a job
 * Called after transit, shift, and second-chance enrichment
 * Sets status to "enriched"
 */
export const enrich = internalMutation({
  args: {
    busAccessible: v.optional(v.boolean()),
    id: v.id('scrapedJobs'),
    railAccessible: v.optional(v.boolean()),
    // Second-chance (legacy)
    secondChance: v.optional(v.boolean()),
    secondChanceConfidence: v.optional(v.float64()),
    // Second-chance audit fields
    secondChanceDebug: v.optional(
      v.object({
        employerContribution: v.number(),
        llmContribution: v.number(),
        onetContribution: v.number(),
        overrideApplied: v.optional(v.string()),
      }),
    ),
    secondChanceEmployerMatch: v.optional(
      v.object({
        matchedName: v.optional(v.string()),
        matchType: v.string(),
        similarity: v.optional(v.float64()),
      }),
    ),
    secondChanceLlmReasoning: v.optional(v.string()),
    secondChanceLlmStance: v.optional(v.string()),
    secondChanceOnetCode: v.optional(v.string()),
    secondChanceReasoning: v.optional(v.string()),
    // Second-chance scoring (new)
    secondChanceScore: v.optional(v.number()),
    secondChanceScoredAt: v.optional(v.float64()),
    secondChanceSignals: v.optional(v.array(v.string())),
    secondChanceTier: v.optional(
      v.union(
        v.literal('high'),
        v.literal('medium'),
        v.literal('low'),
        v.literal('unlikely'),
        v.literal('unknown'),
      ),
    ),
    shiftAfternoon: v.optional(v.boolean()),
    shiftEvening: v.optional(v.boolean()),
    shiftFlexible: v.optional(v.boolean()),
    // Shifts
    shiftMorning: v.optional(v.boolean()),
    shiftOvernight: v.optional(v.boolean()),
    shiftSource: v.optional(v.string()),
    transitDistance: v.optional(v.float64()),
    // Transit
    transitScore: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { id, ...enrichmentData } = args
    await ctx.db.patch(id, {
      ...enrichmentData,
      enrichedAt: Date.now(),
      status: 'enriched',
    })
  },
  returns: v.null(),
})

/**
 * Mark job as indexed to Typesense
 * Sets status to "indexed" and stores Typesense document ID
 */
export const markIndexed = internalMutation({
  args: {
    id: v.id('scrapedJobs'),
    typesenseId: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      indexedAt: Date.now(),
      status: 'indexed',
      typesenseId: args.typesenseId,
    })
  },
  returns: v.null(),
})

// ============================================================================
// Queries
// ============================================================================

/**
 * Get job by ID
 */
export const get = internalQuery({
  args: { id: v.id('scrapedJobs') },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id)
  },
  returns: v.union(scrapedJobDocValidator, v.null()),
})

/**
 * Check if job exists by externalId + source
 * Used as dedup fallback when Redis is unavailable
 */
export const getByExternalId = internalQuery({
  args: {
    externalId: v.string(),
    source: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('scrapedJobs')
      .withIndex('by_external_id_source', q =>
        q.eq('externalId', args.externalId).eq('source', args.source),
      )
      .first()
  },
  returns: v.union(scrapedJobDocValidator, v.null()),
})

/**
 * Get jobs by status
 * Useful for pipeline monitoring and retry logic
 */
export const getByStatus = internalQuery({
  args: {
    limit: v.optional(v.number()),
    status: statusValidator,
  },
  handler: async (ctx, args) => {
    const query = ctx.db
      .query('scrapedJobs')
      .withIndex('by_status', q => q.eq('status', args.status))

    if (args.limit) {
      return await query.take(args.limit)
    }
    return await query.collect()
  },
  returns: v.array(scrapedJobDocValidator),
})

/**
 * Get recent failed jobs for retry/debugging
 */
export const getRecentFailed = internalQuery({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('scrapedJobs')
      .withIndex('by_status', q => q.eq('status', 'failed'))
      .order('desc')
      .take(args.limit ?? 100)
  },
  returns: v.array(scrapedJobDocValidator),
})

/**
 * Get pipeline statistics
 */
export const getStats = internalQuery({
  args: {},
  handler: async ctx => {
    const [scraped, enriching, enriched, indexed, failed] = await Promise.all([
      ctx.db
        .query('scrapedJobs')
        .withIndex('by_status', q => q.eq('status', 'scraped'))
        .collect(),
      ctx.db
        .query('scrapedJobs')
        .withIndex('by_status', q => q.eq('status', 'enriching'))
        .collect(),
      ctx.db
        .query('scrapedJobs')
        .withIndex('by_status', q => q.eq('status', 'enriched'))
        .collect(),
      ctx.db
        .query('scrapedJobs')
        .withIndex('by_status', q => q.eq('status', 'indexed'))
        .collect(),
      ctx.db
        .query('scrapedJobs')
        .withIndex('by_status', q => q.eq('status', 'failed'))
        .collect(),
    ])

    return {
      enriched: enriched.length,
      enriching: enriching.length,
      failed: failed.length,
      indexed: indexed.length,
      scraped: scraped.length,
      total: scraped.length + enriching.length + enriched.length + indexed.length + failed.length,
    }
  },
  returns: v.object({
    enriched: v.number(),
    enriching: v.number(),
    failed: v.number(),
    indexed: v.number(),
    scraped: v.number(),
    total: v.number(),
  }),
})

// ============================================================================
// Admin Queries
// ============================================================================

/**
 * Get full second-chance audit details for a job by typesenseId
 * Used in admin UI to show scoring breakdown popup
 */
export const getSecondChanceAudit = adminQuery({
  args: { typesenseId: v.string() },
  handler: async (ctx, { typesenseId }) => {
    const job = await ctx.db
      .query('scrapedJobs')
      .withIndex('by_typesense_id', q => q.eq('typesenseId', typesenseId))
      .first()

    if (!job) return null

    return {
      // Job context
      company: job.company,
      // Score summary
      confidence: job.secondChanceConfidence,
      // Audit details
      debug: job.secondChanceDebug,
      employerMatch: job.secondChanceEmployerMatch,
      llmReasoning: job.secondChanceLlmReasoning,
      llmStance: job.secondChanceLlmStance,
      onetCode: job.secondChanceOnetCode,
      reasoning: job.secondChanceReasoning,
      score: job.secondChanceScore,
      scoredAt: job.secondChanceScoredAt,
      signals: job.secondChanceSignals,
      tier: job.secondChanceTier,
      title: job.title,
    }
  },
  returns: v.union(
    v.object({
      // Job context
      company: v.string(),
      // Score summary
      confidence: v.optional(v.float64()),
      // Audit details
      debug: v.optional(
        v.object({
          employerContribution: v.number(),
          llmContribution: v.number(),
          onetContribution: v.number(),
          overrideApplied: v.optional(v.string()),
        }),
      ),
      employerMatch: v.optional(
        v.object({
          matchedName: v.optional(v.string()),
          matchType: v.string(),
          similarity: v.optional(v.float64()),
        }),
      ),
      llmReasoning: v.optional(v.string()),
      llmStance: v.optional(v.string()),
      onetCode: v.optional(v.string()),
      reasoning: v.optional(v.string()),
      score: v.optional(v.number()),
      scoredAt: v.optional(v.float64()),
      signals: v.optional(v.array(v.string())),
      tier: v.optional(
        v.union(
          v.literal('high'),
          v.literal('medium'),
          v.literal('low'),
          v.literal('unlikely'),
          v.literal('unknown'),
        ),
      ),
      title: v.string(),
    }),
    v.null(),
  ),
})

// ============================================================================
// Admin Actions (Redis Cache Management)
// ============================================================================

/**
 * Get Redis dedup cache statistics
 * Proxies to scrape-pipeline admin endpoint
 */
export const getCacheStats = adminAction({
  args: {},
  handler: async () => {
    const pipelineUrl = process.env.SCRAPE_PIPELINE_URL
    const pipelineSecret = process.env.SCRAPE_PIPELINE_SECRET

    if (!pipelineUrl || !pipelineSecret) {
      throw new Error('SCRAPE_PIPELINE_URL or SCRAPE_PIPELINE_SECRET not configured')
    }

    const response = await fetch(`${pipelineUrl}/api/admin/cache/stats`, {
      headers: {
        'X-Pipeline-Secret': pipelineSecret,
      },
      method: 'GET',
    })

    if (!response.ok) {
      const text = await response.text()
      throw new Error(`Failed to get cache stats: ${response.status} ${text}`)
    }

    return response.json()
  },
  returns: v.any(),
})

/**
 * Clear Redis dedup cache
 * Can clear all or by date range
 */
export const clearCache = adminAction({
  args: {
    clearAll: v.optional(v.boolean()),
    endDate: v.optional(v.string()),
    startDate: v.optional(v.string()),
  },
  handler: async (_ctx, args) => {
    const pipelineUrl = process.env.SCRAPE_PIPELINE_URL
    const pipelineSecret = process.env.SCRAPE_PIPELINE_SECRET

    if (!pipelineUrl || !pipelineSecret) {
      throw new Error('SCRAPE_PIPELINE_URL or SCRAPE_PIPELINE_SECRET not configured')
    }

    const body: Record<string, unknown> = {}
    if (args.clearAll) {
      body.clearAll = true
    } else if (args.startDate && args.endDate) {
      body.startDate = args.startDate
      body.endDate = args.endDate
    } else {
      throw new Error('Specify clearAll or startDate/endDate')
    }

    const response = await fetch(`${pipelineUrl}/api/admin/cache/clear`, {
      body: JSON.stringify(body),
      headers: {
        'Content-Type': 'application/json',
        'X-Pipeline-Secret': pipelineSecret,
      },
      method: 'POST',
    })

    if (!response.ok) {
      const text = await response.text()
      throw new Error(`Failed to clear cache: ${response.status} ${text}`)
    }

    return response.json()
  },
  returns: v.any(),
})

/**
 * Get fair chance employer statistics from Redis
 */
export const getFairChanceStats = adminAction({
  args: {},
  handler: async () => {
    const pipelineUrl = process.env.SCRAPE_PIPELINE_URL
    const pipelineSecret = process.env.SCRAPE_PIPELINE_SECRET

    if (!pipelineUrl || !pipelineSecret) {
      throw new Error('SCRAPE_PIPELINE_URL or SCRAPE_PIPELINE_SECRET not configured')
    }

    const response = await fetch(`${pipelineUrl}/api/admin/fair-chance/stats`, {
      headers: {
        'X-Pipeline-Secret': pipelineSecret,
      },
      method: 'GET',
    })

    if (!response.ok) {
      const text = await response.text()
      throw new Error(`Failed to get fair chance stats: ${response.status} ${text}`)
    }

    return response.json()
  },
  returns: v.any(),
})

// ============================================================================
// Delete Operations
// ============================================================================

/**
 * Delete a single scraped job from Convex
 * Returns info needed for Typesense/Redis cleanup
 */
export const deleteJob = internalMutation({
  args: { id: v.id('scrapedJobs') },
  handler: async (ctx, { id }) => {
    const job = await ctx.db.get(id)
    if (!job) {
      throw new Error(`Job not found: ${id}`)
    }
    await ctx.db.delete(id)
    return {
      externalId: job.externalId,
      source: job.source,
      typesenseId: job.typesenseId,
    }
  },
  returns: v.object({
    externalId: v.string(),
    source: v.string(),
    typesenseId: v.optional(v.string()),
  }),
})

/**
 * Delete multiple scraped jobs from Convex
 * Returns info for each job for Typesense/Redis cleanup
 */
export const deleteJobs = internalMutation({
  args: { ids: v.array(v.id('scrapedJobs')) },
  handler: async (ctx, { ids }) => {
    const results: Array<
      | {
          id: Id<'scrapedJobs'>
          deleted: true
          externalId: string
          source: string
          typesenseId?: string
        }
      | { id: Id<'scrapedJobs'>; deleted: false; error: string }
    > = []
    for (const id of ids) {
      const job = await ctx.db.get(id)
      if (job) {
        await ctx.db.delete(id)
        results.push({
          deleted: true as const,
          externalId: job.externalId,
          id,
          source: job.source,
          typesenseId: job.typesenseId,
        })
      } else {
        results.push({ deleted: false as const, error: 'not_found', id })
      }
    }
    return results
  },
  returns: v.array(
    v.union(
      v.object({
        deleted: v.literal(true),
        externalId: v.string(),
        id: v.id('scrapedJobs'),
        source: v.string(),
        typesenseId: v.optional(v.string()),
      }),
      v.object({
        deleted: v.literal(false),
        error: v.string(),
        id: v.id('scrapedJobs'),
      }),
    ),
  ),
})

/**
 * Get Convex job by typesenseId
 * Used to map Typesense search results to Convex IDs for deletion
 */
export const getByTypesenseId = internalQuery({
  args: { typesenseId: v.string() },
  handler: async (ctx, { typesenseId }) => {
    return await ctx.db
      .query('scrapedJobs')
      .withIndex('by_typesense_id', q => q.eq('typesenseId', typesenseId))
      .first()
  },
  returns: v.union(scrapedJobDocValidator, v.null()),
})

/**
 * Admin action to delete a single job from Convex + Typesense + Redis
 * Can accept either Convex ID or typesenseId
 */
export const adminDeleteJob = adminAction({
  args: {
    id: v.optional(v.id('scrapedJobs')),
    typesenseId: v.optional(v.string()),
  },
  handler: async (ctx, { id, typesenseId }) => {
    const pipelineUrl = process.env.SCRAPE_PIPELINE_URL
    const pipelineSecret = process.env.SCRAPE_PIPELINE_SECRET

    if (!pipelineUrl || !pipelineSecret) {
      throw new Error('SCRAPE_PIPELINE_URL or SCRAPE_PIPELINE_SECRET not configured')
    }

    if (!id && !typesenseId) {
      throw new Error('Must provide either id or typesenseId')
    }

    const { api } = require('./_generated/api')

    // If only typesenseId provided, look up Convex ID
    let convexId = id
    if (!convexId && typesenseId) {
      const job = await ctx.runQuery(api.scrapedJobs.getByTypesenseId, { typesenseId })
      if (!job) {
        throw new Error(`Job not found for typesenseId: ${typesenseId}`)
      }
      convexId = job._id
    }

    // Delete from Convex first (source of truth)
    const result = await ctx.runMutation(api.scrapedJobs.deleteJob, { id: convexId! })

    // Delete from Typesense + Redis
    if (result.typesenseId) {
      const response = await fetch(`${pipelineUrl}/api/admin/typesense/delete`, {
        body: JSON.stringify({
          externalIds: [result.externalId],
          typesenseIds: [result.typesenseId],
        }),
        headers: {
          'Content-Type': 'application/json',
          'X-Pipeline-Secret': pipelineSecret,
        },
        method: 'POST',
      })

      if (!response.ok) {
        const text = await response.text()
        throw new Error(`Failed to delete from Typesense: ${response.status} ${text}`)
      }
    }

    return { success: true, ...result }
  },
  returns: v.object({
    externalId: v.string(),
    source: v.string(),
    success: v.boolean(),
    typesenseId: v.optional(v.string()),
  }),
})

/**
 * Admin action to delete multiple jobs from Convex + Typesense + Redis
 */
export const adminDeleteJobs = adminAction({
  args: { ids: v.array(v.id('scrapedJobs')) },
  handler: async (ctx, { ids }) => {
    const pipelineUrl = process.env.SCRAPE_PIPELINE_URL
    const pipelineSecret = process.env.SCRAPE_PIPELINE_SECRET

    if (!pipelineUrl || !pipelineSecret) {
      throw new Error('SCRAPE_PIPELINE_URL or SCRAPE_PIPELINE_SECRET not configured')
    }

    // Delete from Convex first (source of truth)
    const { api } = require('./_generated/api')
    const results = await ctx.runMutation(api.scrapedJobs.deleteJobs, { ids })

    // Collect typesense IDs and external IDs for cleanup
    const typesenseIds: Array<string> = []
    const externalIds: Array<string> = []
    for (const r of results) {
      if (r.deleted && r.typesenseId) {
        typesenseIds.push(r.typesenseId)
        externalIds.push(r.externalId)
      }
    }

    // Delete from Typesense + Redis
    if (typesenseIds.length > 0) {
      const response = await fetch(`${pipelineUrl}/api/admin/typesense/delete`, {
        body: JSON.stringify({ externalIds, typesenseIds }),
        headers: {
          'Content-Type': 'application/json',
          'X-Pipeline-Secret': pipelineSecret,
        },
        method: 'POST',
      })

      if (!response.ok) {
        const text = await response.text()
        throw new Error(`Failed to delete from Typesense: ${response.status} ${text}`)
      }
    }

    const deleted = results.filter((r: any) => r.deleted).length
    const failed = results.filter((r: any) => !r.deleted).length

    return { deleted, failed, results, success: true }
  },
  returns: v.object({
    deleted: v.number(),
    failed: v.number(),
    results: v.any(),
    success: v.boolean(),
  }),
})

// ============================================================================
// Nuke All (Dev Only)
// ============================================================================

/**
 * Internal query to get all job IDs (for nuking)
 */
export const listAll = internalQuery({
  args: {},
  handler: async ctx => {
    const jobs = await ctx.db.query('scrapedJobs').collect()
    return jobs.map(j => ({ _id: j._id }))
  },
  returns: v.array(v.object({ _id: v.id('scrapedJobs') })),
})

/**
 * Internal mutation to delete a batch of jobs (no external cleanup)
 */
export const deleteJobsBatch = internalMutation({
  args: { ids: v.array(v.id('scrapedJobs')) },
  handler: async (ctx, { ids }) => {
    for (const id of ids) {
      await ctx.db.delete(id)
    }
    return null
  },
  returns: v.null(),
})

/**
 * DEV ONLY: Nuke all scraped jobs from Convex + Typesense + Redis
 */
export const nukeAllJobs = adminAction({
  args: {},
  handler: async ctx => {
    const pipelineUrl = process.env.SCRAPE_PIPELINE_URL
    const pipelineSecret = process.env.SCRAPE_PIPELINE_SECRET

    if (!pipelineUrl || !pipelineSecret) {
      throw new Error('SCRAPE_PIPELINE_URL or SCRAPE_PIPELINE_SECRET not configured')
    }

    // 1. Get all scrapedJobs from Convex
    const allJobs = await ctx.runQuery(internal.scrapedJobs.listAll)
    const allIds = allJobs.map(j => j._id)

    // 2. Delete from Convex in batches (if any exist)
    let convexDeleted = 0
    if (allIds.length > 0) {
      const BATCH_SIZE = 100
      for (let i = 0; i < allIds.length; i += BATCH_SIZE) {
        const batch = allIds.slice(i, i + BATCH_SIZE)
        await ctx.runMutation(internal.scrapedJobs.deleteJobsBatch, { ids: batch })
        convexDeleted += batch.length
      }
    }

    // 3. Call pipeline to nuke Typesense + Redis
    const response = await fetch(`${pipelineUrl}/api/admin/nuke-all`, {
      headers: {
        'Content-Type': 'application/json',
        'X-Pipeline-Secret': pipelineSecret,
      },
      method: 'POST',
    })

    if (!response.ok) {
      const text = await response.text()
      throw new Error(`Pipeline nuke failed: ${response.status} ${text}`)
    }

    return {
      convexDeleted,
      message: `Deleted ${convexDeleted} jobs from Convex, nuked Typesense + Redis`,
      success: true,
    }
  },
  returns: v.object({
    convexDeleted: v.number(),
    message: v.string(),
    success: v.boolean(),
  }),
})

// ============================================================================
// Migrations
// ============================================================================

/**
 * Migration: Remove deprecated noBackgroundCheck field from all documents
 * Run this once, then remove noBackgroundCheck from schema.ts
 *
 * Usage: Call from Convex dashboard or via API
 */
export const migrateRemoveNoBackgroundCheck = internalMutation({
  args: {
    batchSize: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const batchSize = args.batchSize ?? 100

    // Get a batch of documents
    const docs = await ctx.db.query('scrapedJobs').take(batchSize)

    let updated = 0

    for (const doc of docs) {
      // Check if document has the deprecated field
      if ('noBackgroundCheck' in doc) {
        // Create a new object without the deprecated field
        const { noBackgroundCheck: _, _id, _creationTime, ...rest } = doc as any

        // Replace the document (this removes the field)
        await ctx.db.replace(doc._id, rest)
        updated++
      }
    }

    // Check if there are more documents to process
    const remaining = await ctx.db.query('scrapedJobs').take(1)

    // We need to check if any remaining docs have the field
    // For simplicity, just report if we processed a full batch
    const hasMore = docs.length === batchSize && updated > 0

    return {
      hasMore,
      processed: docs.length,
      updated,
    }
  },
  returns: v.object({
    hasMore: v.boolean(),
    processed: v.number(),
    updated: v.number(),
  }),
})
