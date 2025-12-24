/**
 * Scraped Jobs - Mutations and Queries
 *
 * Handles jobs scraped from external job boards (Snagajob, Indeed, etc.)
 * Called from the scrape-jobs pipeline via HTTP API.
 *
 * Note: The Typesense search action is in scrapedJobsSearch.ts (requires Node.js runtime)
 */

import { v } from 'convex/values';
import { internalMutation, internalQuery } from './_generated/server';
import { adminAction } from './functions';

import type { Id } from './_generated/dataModel';

// Status type for reuse
const statusValidator = v.union(
  v.literal('scraped'),
  v.literal('enriching'),
  v.literal('enriched'),
  v.literal('indexed'),
  v.literal('failed')
);

// Scraped job document validator for return types
const scrapedJobDocValidator = v.object({
  _id: v.id('scrapedJobs'),
  _creationTime: v.number(),
  // External identification
  externalId: v.string(),
  source: v.string(),
  // Core job data
  company: v.string(),
  title: v.string(),
  description: v.optional(v.string()),
  url: v.string(),
  // Location
  city: v.optional(v.string()),
  state: v.optional(v.string()),
  lat: v.optional(v.float64()),
  lng: v.optional(v.float64()),
  // Salary
  payMin: v.optional(v.float64()),
  payMax: v.optional(v.float64()),
  payType: v.optional(v.string()),
  // Job metadata
  isUrgent: v.optional(v.boolean()),
  isEasyApply: v.optional(v.boolean()),
  postedAt: v.optional(v.number()),
  // Enrichment: Transit
  transitScore: v.optional(v.string()),
  transitDistance: v.optional(v.float64()),
  busAccessible: v.optional(v.boolean()),
  railAccessible: v.optional(v.boolean()),
  // Enrichment: Shifts
  shiftMorning: v.optional(v.boolean()),
  shiftAfternoon: v.optional(v.boolean()),
  shiftEvening: v.optional(v.boolean()),
  shiftOvernight: v.optional(v.boolean()),
  shiftFlexible: v.optional(v.boolean()),
  shiftSource: v.optional(v.string()),
  // Enrichment: Second-chance
  secondChance: v.optional(v.boolean()),
  noBackgroundCheck: v.optional(v.boolean()),
  // Pipeline status tracking
  status: statusValidator,
  // Pipeline timestamps
  scrapedAt: v.number(),
  enrichedAt: v.optional(v.number()),
  indexedAt: v.optional(v.number()),
  // Error tracking
  failureReason: v.optional(v.string()),
  failureStage: v.optional(v.string()),
  // Typesense reference
  typesenseId: v.optional(v.string()),
});

// ============================================================================
// Mutations
// ============================================================================

/**
 * Insert a new scraped job with status "scraped"
 * Called immediately after dedup passes in the pipeline
 */
export const insert = internalMutation({
  args: {
    externalId: v.string(),
    source: v.string(),
    company: v.string(),
    title: v.string(),
    description: v.optional(v.string()),
    url: v.string(),
    city: v.optional(v.string()),
    state: v.optional(v.string()),
    lat: v.optional(v.float64()),
    lng: v.optional(v.float64()),
    payMin: v.optional(v.float64()),
    payMax: v.optional(v.float64()),
    payType: v.optional(v.string()),
    isUrgent: v.optional(v.boolean()),
    isEasyApply: v.optional(v.boolean()),
    postedAt: v.optional(v.number()),
  },
  returns: v.id('scrapedJobs'),
  handler: async (ctx, args) => {
    const id = await ctx.db.insert('scrapedJobs', {
      ...args,
      status: 'scraped',
      scrapedAt: Date.now(),
    });
    return id;
  },
});

/**
 * Update job status
 * Used for status transitions and error handling
 */
export const updateStatus = internalMutation({
  args: {
    id: v.id('scrapedJobs'),
    status: statusValidator,
    failureReason: v.optional(v.string()),
    failureStage: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { id, status, failureReason, failureStage } = args;
    const updates: Record<string, unknown> = { status };

    if (failureReason !== undefined) updates.failureReason = failureReason;
    if (failureStage !== undefined) updates.failureStage = failureStage;

    await ctx.db.patch(id, updates);
  },
});

/**
 * Add enrichment data to a job
 * Called after transit, shift, and second-chance enrichment
 * Sets status to "enriched"
 */
export const enrich = internalMutation({
  args: {
    id: v.id('scrapedJobs'),
    // Transit
    transitScore: v.optional(v.string()),
    transitDistance: v.optional(v.float64()),
    busAccessible: v.optional(v.boolean()),
    railAccessible: v.optional(v.boolean()),
    // Shifts
    shiftMorning: v.optional(v.boolean()),
    shiftAfternoon: v.optional(v.boolean()),
    shiftEvening: v.optional(v.boolean()),
    shiftOvernight: v.optional(v.boolean()),
    shiftFlexible: v.optional(v.boolean()),
    shiftSource: v.optional(v.string()),
    // Second-chance
    secondChance: v.optional(v.boolean()),
    noBackgroundCheck: v.optional(v.boolean()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { id, ...enrichmentData } = args;
    await ctx.db.patch(id, {
      ...enrichmentData,
      status: 'enriched',
      enrichedAt: Date.now(),
    });
  },
});

/**
 * Mark job as indexed to Typesense
 * Sets status to "indexed" and stores Typesense document ID
 */
export const markIndexed = internalMutation({
  args: {
    id: v.id('scrapedJobs'),
    typesenseId: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      status: 'indexed',
      indexedAt: Date.now(),
      typesenseId: args.typesenseId,
    });
  },
});

// ============================================================================
// Queries
// ============================================================================

/**
 * Get job by ID
 */
export const get = internalQuery({
  args: { id: v.id('scrapedJobs') },
  returns: v.union(scrapedJobDocValidator, v.null()),
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

/**
 * Check if job exists by externalId + source
 * Used as dedup fallback when Redis is unavailable
 */
export const getByExternalId = internalQuery({
  args: {
    externalId: v.string(),
    source: v.string(),
  },
  returns: v.union(scrapedJobDocValidator, v.null()),
  handler: async (ctx, args) => {
    return await ctx.db
      .query('scrapedJobs')
      .withIndex('by_external_id_source', (q) =>
        q.eq('externalId', args.externalId).eq('source', args.source)
      )
      .first();
  },
});

/**
 * Get jobs by status
 * Useful for pipeline monitoring and retry logic
 */
export const getByStatus = internalQuery({
  args: {
    status: statusValidator,
    limit: v.optional(v.number()),
  },
  returns: v.array(scrapedJobDocValidator),
  handler: async (ctx, args) => {
    const query = ctx.db
      .query('scrapedJobs')
      .withIndex('by_status', (q) => q.eq('status', args.status));

    if (args.limit) {
      return await query.take(args.limit);
    }
    return await query.collect();
  },
});

/**
 * Get recent failed jobs for retry/debugging
 */
export const getRecentFailed = internalQuery({
  args: {
    limit: v.optional(v.number()),
  },
  returns: v.array(scrapedJobDocValidator),
  handler: async (ctx, args) => {
    return await ctx.db
      .query('scrapedJobs')
      .withIndex('by_status', (q) => q.eq('status', 'failed'))
      .order('desc')
      .take(args.limit ?? 100);
  },
});

/**
 * Get pipeline statistics
 */
export const getStats = internalQuery({
  args: {},
  returns: v.object({
    scraped: v.number(),
    enriching: v.number(),
    enriched: v.number(),
    indexed: v.number(),
    failed: v.number(),
    total: v.number(),
  }),
  handler: async (ctx) => {
    const [scraped, enriching, enriched, indexed, failed] = await Promise.all([
      ctx.db
        .query('scrapedJobs')
        .withIndex('by_status', (q) => q.eq('status', 'scraped'))
        .collect(),
      ctx.db
        .query('scrapedJobs')
        .withIndex('by_status', (q) => q.eq('status', 'enriching'))
        .collect(),
      ctx.db
        .query('scrapedJobs')
        .withIndex('by_status', (q) => q.eq('status', 'enriched'))
        .collect(),
      ctx.db
        .query('scrapedJobs')
        .withIndex('by_status', (q) => q.eq('status', 'indexed'))
        .collect(),
      ctx.db
        .query('scrapedJobs')
        .withIndex('by_status', (q) => q.eq('status', 'failed'))
        .collect(),
    ]);

    return {
      scraped: scraped.length,
      enriching: enriching.length,
      enriched: enriched.length,
      indexed: indexed.length,
      failed: failed.length,
      total:
        scraped.length +
        enriching.length +
        enriched.length +
        indexed.length +
        failed.length,
    };
  },
});

// ============================================================================
// Admin Actions (Redis Cache Management)
// ============================================================================

/**
 * Get Redis dedup cache statistics
 * Proxies to scrape-pipeline admin endpoint
 */
export const getCacheStats = adminAction({
  args: {},
  returns: v.any(),
  handler: async () => {
    const pipelineUrl = process.env.SCRAPE_PIPELINE_URL;
    const pipelineSecret = process.env.SCRAPE_PIPELINE_SECRET;

    if (!pipelineUrl || !pipelineSecret) {
      throw new Error('SCRAPE_PIPELINE_URL or SCRAPE_PIPELINE_SECRET not configured');
    }

    const response = await fetch(`${pipelineUrl}/api/admin/cache/stats`, {
      method: 'GET',
      headers: {
        'X-Pipeline-Secret': pipelineSecret,
      },
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Failed to get cache stats: ${response.status} ${text}`);
    }

    return response.json();
  },
});

/**
 * Clear Redis dedup cache
 * Can clear all or by date range
 */
export const clearCache = adminAction({
  args: {
    clearAll: v.optional(v.boolean()),
    startDate: v.optional(v.string()),
    endDate: v.optional(v.string()),
  },
  returns: v.any(),
  handler: async (_ctx, args) => {
    const pipelineUrl = process.env.SCRAPE_PIPELINE_URL;
    const pipelineSecret = process.env.SCRAPE_PIPELINE_SECRET;

    if (!pipelineUrl || !pipelineSecret) {
      throw new Error('SCRAPE_PIPELINE_URL or SCRAPE_PIPELINE_SECRET not configured');
    }

    const body: Record<string, unknown> = {};
    if (args.clearAll) {
      body.clearAll = true;
    } else if (args.startDate && args.endDate) {
      body.startDate = args.startDate;
      body.endDate = args.endDate;
    } else {
      throw new Error('Specify clearAll or startDate/endDate');
    }

    const response = await fetch(`${pipelineUrl}/api/admin/cache/clear`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Pipeline-Secret': pipelineSecret,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Failed to clear cache: ${response.status} ${text}`);
    }

    return response.json();
  },
});

// ============================================================================
// Delete Operations
// ============================================================================

/**
 * Delete a single scraped job from Convex
 * Returns info needed for Typesense/Redis cleanup
 */
export const deleteJob = internalMutation({
  args: { id: v.id('scrapedJobs') },
  returns: v.object({
    externalId: v.string(),
    source: v.string(),
    typesenseId: v.optional(v.string()),
  }),
  handler: async (ctx, { id }) => {
    const job = await ctx.db.get(id);
    if (!job) {
      throw new Error(`Job not found: ${id}`);
    }
    await ctx.db.delete(id);
    return {
      externalId: job.externalId,
      source: job.source,
      typesenseId: job.typesenseId,
    };
  },
});

/**
 * Delete multiple scraped jobs from Convex
 * Returns info for each job for Typesense/Redis cleanup
 */
export const deleteJobs = internalMutation({
  args: { ids: v.array(v.id('scrapedJobs')) },
  returns: v.array(
    v.union(
      v.object({
        id: v.id('scrapedJobs'),
        deleted: v.literal(true),
        externalId: v.string(),
        source: v.string(),
        typesenseId: v.optional(v.string()),
      }),
      v.object({
        id: v.id('scrapedJobs'),
        deleted: v.literal(false),
        error: v.string(),
      })
    )
  ),
  handler: async (ctx, { ids }) => {
    const results: Array<
      | { id: Id<'scrapedJobs'>; deleted: true; externalId: string; source: string; typesenseId?: string }
      | { id: Id<'scrapedJobs'>; deleted: false; error: string }
    > = [];
    for (const id of ids) {
      const job = await ctx.db.get(id);
      if (job) {
        await ctx.db.delete(id);
        results.push({
          id,
          deleted: true as const,
          externalId: job.externalId,
          source: job.source,
          typesenseId: job.typesenseId,
        });
      } else {
        results.push({ id, deleted: false as const, error: 'not_found' });
      }
    }
    return results;
  },
});

/**
 * Get Convex job by typesenseId
 * Used to map Typesense search results to Convex IDs for deletion
 */
export const getByTypesenseId = internalQuery({
  args: { typesenseId: v.string() },
  returns: v.union(scrapedJobDocValidator, v.null()),
  handler: async (ctx, { typesenseId }) => {
    return await ctx.db
      .query('scrapedJobs')
      .withIndex('by_typesense_id', (q) => q.eq('typesenseId', typesenseId))
      .first();
  },
});

/**
 * Admin action to delete a single job from Convex + Typesense + Redis
 * Can accept either Convex ID or typesenseId
 */
export const adminDeleteJob = adminAction({
  args: {
    id: v.optional(v.id('scrapedJobs')),
    typesenseId: v.optional(v.string()),
  },
  returns: v.object({
    success: v.boolean(),
    externalId: v.string(),
    source: v.string(),
    typesenseId: v.optional(v.string()),
  }),
  handler: async (ctx, { id, typesenseId }) => {
    const pipelineUrl = process.env.SCRAPE_PIPELINE_URL;
    const pipelineSecret = process.env.SCRAPE_PIPELINE_SECRET;

    if (!pipelineUrl || !pipelineSecret) {
      throw new Error('SCRAPE_PIPELINE_URL or SCRAPE_PIPELINE_SECRET not configured');
    }

    if (!id && !typesenseId) {
      throw new Error('Must provide either id or typesenseId');
    }

    const { api } = require('./_generated/api');

    // If only typesenseId provided, look up Convex ID
    let convexId = id;
    if (!convexId && typesenseId) {
      const job = await ctx.runQuery(api.scrapedJobs.getByTypesenseId, { typesenseId });
      if (!job) {
        throw new Error(`Job not found for typesenseId: ${typesenseId}`);
      }
      convexId = job._id;
    }

    // Delete from Convex first (source of truth)
    const result = await ctx.runMutation(api.scrapedJobs.deleteJob, { id: convexId! });

    // Delete from Typesense + Redis
    if (result.typesenseId) {
      const response = await fetch(`${pipelineUrl}/api/admin/typesense/delete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Pipeline-Secret': pipelineSecret,
        },
        body: JSON.stringify({
          typesenseIds: [result.typesenseId],
          externalIds: [result.externalId],
        }),
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Failed to delete from Typesense: ${response.status} ${text}`);
      }
    }

    return { success: true, ...result };
  },
});

/**
 * Admin action to delete multiple jobs from Convex + Typesense + Redis
 */
export const adminDeleteJobs = adminAction({
  args: { ids: v.array(v.id('scrapedJobs')) },
  returns: v.object({
    success: v.boolean(),
    deleted: v.number(),
    failed: v.number(),
    results: v.any(),
  }),
  handler: async (ctx, { ids }) => {
    const pipelineUrl = process.env.SCRAPE_PIPELINE_URL;
    const pipelineSecret = process.env.SCRAPE_PIPELINE_SECRET;

    if (!pipelineUrl || !pipelineSecret) {
      throw new Error('SCRAPE_PIPELINE_URL or SCRAPE_PIPELINE_SECRET not configured');
    }

    // Delete from Convex first (source of truth)
    const { api } = require('./_generated/api');
    const results = await ctx.runMutation(api.scrapedJobs.deleteJobs, { ids });

    // Collect typesense IDs and external IDs for cleanup
    const typesenseIds: Array<string> = [];
    const externalIds: Array<string> = [];
    for (const r of results) {
      if (r.deleted && r.typesenseId) {
        typesenseIds.push(r.typesenseId);
        externalIds.push(r.externalId);
      }
    }

    // Delete from Typesense + Redis
    if (typesenseIds.length > 0) {
      const response = await fetch(`${pipelineUrl}/api/admin/typesense/delete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Pipeline-Secret': pipelineSecret,
        },
        body: JSON.stringify({ typesenseIds, externalIds }),
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Failed to delete from Typesense: ${response.status} ${text}`);
      }
    }

    const deleted = results.filter((r: any) => r.deleted).length;
    const failed = results.filter((r: any) => !r.deleted).length;

    return { success: true, deleted, failed, results };
  },
});
