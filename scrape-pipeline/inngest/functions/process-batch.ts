/**
 * Process Batch Function
 *
 * Triggered by batch/process event.
 * Receives a batch of jobs with details already fetched.
 * Handles: dedup → Convex insert → enrich → Convex enrich → index → Convex mark indexed
 */

import { inngest } from "../client";
import { getRedis } from "../../lib/redis";
import * as dedup from "../../dedup/job-dedup-enhanced.js";
import * as geocoder from "../../dedup/geocoder-mapbox.js";
import { enrichJob } from "../../lib/enrichment";
import { loadTransitData, scoreTransitAccess } from "../../transit-scorer";
import { indexJob, type EnrichedJob } from "../../lib/typesense";
import {
  insertJob,
  enrichConvexJob,
  markJobIndexed,
  type ConvexJobInput,
  type ConvexJobEnrichment,
} from "../../lib/convex";
import type { SnagajobJob } from "../../scrapers/snagajob";
import type { ShiftResult } from "../../lib/enrichment/shift-extractor";
import type { TransitScore } from "../../transit-scorer";
// Multi-signal second-chance scoring
import { analyzeJobForSecondChanceSafe } from "../../lib/enrichment/second-chance-llm";
import { getEmployerSignal } from "../../lib/enrichment/second-chance-employer";
import {
  computeSecondChanceScore,
  generateLLMSignal,
  generateOnetSignal,
  type SecondChanceScore,
} from "../../lib/enrichment/second-chance-scorer";

// Helper: Convert SnagajobJob to ConvexJobInput
// Note: Convex rejects null, only accepts undefined for optional fields
function toConvexInput(job: SnagajobJob, source: string): ConvexJobInput {
  return {
    externalId: job.id,
    source,
    company: job.company,
    title: job.title,
    description: job.descriptionText ?? undefined,
    url: job.applyUrl,
    city: job.city ?? undefined,
    state: job.state ?? undefined,
    lat: job.latitude ?? undefined,
    lng: job.longitude ?? undefined,
    payMin: job.payMin ?? undefined,
    payMax: job.payMax ?? undefined,
    payType: job.payType ?? undefined,
    isUrgent: job.isUrgent ?? undefined,
    isEasyApply: job.isEasyApply ?? undefined,
    postedAt: job.postedDate ? new Date(job.postedDate).getTime() : undefined,
  };
}

// Helper: Convert enrichment results to Convex enrichment format
function toConvexEnrichment(
  shifts: ShiftResult | undefined,
  transit: TransitScore | undefined,
  secondChanceScore: SecondChanceScore | undefined
): ConvexJobEnrichment {
  return {
    // Transit
    transitScore: transit?.score,
    transitDistance: transit?.distanceMiles,
    busAccessible: transit ? transit.nearbyStops > 0 && !transit.nearbyRail : undefined,
    railAccessible: transit?.nearbyRail,
    // Shifts
    shiftMorning: shifts?.morning,
    shiftAfternoon: shifts?.afternoon,
    shiftEvening: shifts?.evening,
    shiftOvernight: shifts?.overnight,
    shiftFlexible: shifts?.flexible,
    shiftSource: shifts?.source,
    // Second-chance (derive legacy boolean from tier)
    secondChance: secondChanceScore
      ? secondChanceScore.tier === 'high' || secondChanceScore.tier === 'medium'
      : undefined,
    secondChanceScore: secondChanceScore?.score,
    secondChanceTier: secondChanceScore?.tier,
    secondChanceConfidence: secondChanceScore?.confidence,
    secondChanceSignals: secondChanceScore?.signals,
    secondChanceReasoning: secondChanceScore?.reasoning,
  };
}

export const processBatch = inngest.createFunction(
  {
    id: "process-batch",
    concurrency: { limit: 5 },
    retries: 3,
  },
  { event: "batch/process" },
  async ({ event, step, logger }) => {
    const { jobs, source } = event.data;
    logger.info(`Processing batch of ${jobs.length} jobs from ${source}`);

    // Initialize services
    await step.run("init", async () => {
      const redis = getRedis();
      const mapboxKey = process.env.MAPBOX_API_KEY;
      if (!mapboxKey) throw new Error("MAPBOX_API_KEY env var is required");
      await geocoder.initialize({ apiKey: mapboxKey });
      await dedup.initialize({ redis, geocoder: geocoder.geocode });
      await loadTransitData();
    });

    // Process each job: dedup → convex insert → enrich → convex enrich → index → convex mark indexed
    const results = await step.run("process-jobs", async () => {
      let indexed = 0;
      let duplicates = 0;

      for (const job of jobs) {
        // Step 1: Dedup check (Redis)
        const dedupResult = await dedup.processJob({
          id: job.id,
          company: job.company,
          title: job.title,
          description: job.descriptionText || "",
          location: `${job.city || ""}, ${job.state || ""}`,
          lat: job.latitude,
          lng: job.longitude,
        });

        if (dedupResult.isDuplicate) {
          duplicates++;
          continue;
        }

        // Step 2: Insert to Convex
        const convexId = await insertJob(toConvexInput(job, source));

        // Step 3: Enrich (shifts + transit)
        const enrichResult = await enrichJob(job);
        const { shifts } = enrichResult;
        const transit = job.latitude && job.longitude
          ? await scoreTransitAccess(job.latitude, job.longitude)
          : undefined;

        // Step 4: Multi-signal second-chance scoring
        const llmAnalysis = await analyzeJobForSecondChanceSafe(job.descriptionText);
        const llmSignal = generateLLMSignal(llmAnalysis);
        const employerSignal = await getEmployerSignal(job.company);
        const onetSignal = generateOnetSignal(job.onetCode);
        const secondChanceScore = computeSecondChanceScore({
          llm: llmSignal,
          employer: employerSignal,
          onet: onetSignal,
        });

        // Step 5: Update Convex with enrichment data
        await enrichConvexJob(convexId, toConvexEnrichment(shifts, transit, secondChanceScore));

        // Step 6: Index to Typesense
        const enrichedJob: EnrichedJob = { ...job, transit, shifts, secondChanceScore };
        await indexJob(enrichedJob, source);
        const typesenseId = `${source}-${job.id}`;

        // Step 7: Mark as indexed in Convex
        await markJobIndexed(convexId, typesenseId);

        indexed++;
        logger.info(`Indexed: ${job.title} at ${job.company}`);
      }

      // Record daily metrics to Redis
      const redis = getRedis();
      const today = new Date().toISOString().split('T')[0];
      const metricsKey = `dedup:metrics:${today}`;
      await redis.hincrby(metricsKey, 'processed', jobs.length);
      await redis.hincrby(metricsKey, 'duplicates', duplicates);
      await redis.hincrby(metricsKey, 'indexed', indexed);
      await redis.hincrby(metricsKey, `source:${source}`, jobs.length);
      await redis.expire(metricsKey, 60 * 60 * 24 * 30); // 30 days

      return { indexed, duplicates };
    });

    logger.info(`Batch complete: ${results.indexed} indexed, ${results.duplicates} duplicates`);
    return results;
  }
);
