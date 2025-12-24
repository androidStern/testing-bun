/**
 * Enrich Job Function
 *
 * Triggered by job/needs-enrichment event.
 * Receives the full job object from scrape-batch.
 * Runs enrichment pipeline: shifts, second-chance, transit scoring.
 * Indexes enriched job to Typesense.
 */

import { inngest } from "../client";
import { enrichJob } from "../../lib/enrichment";
import { loadTransitData, scoreTransitAccess } from "../../transit-scorer";
import { indexJob, type EnrichedJob } from "../../lib/typesense";

export const enrichJobFn = inngest.createFunction(
  {
    id: "enrich-job",
    concurrency: { limit: 5 },
    retries: 3,
  },
  { event: "job/needs-enrichment" },
  async ({ event, step, logger }) => {
    const { job, source } = event.data;
    logger.info(`Enriching job ${job.id} from ${source}: ${job.title} at ${job.company}`);

    // Extract shifts and second-chance signals
    const { shifts, secondChance } = await step.run("enrich-content", async () => {
      return await enrichJob(job);
    });

    logger.info(`Shifts: ${JSON.stringify(shifts)}`);
    logger.info(`Second chance: ${secondChance.isSecondChance}`);

    // Compute transit score
    const transit = await step.run("compute-transit", async () => {
      await loadTransitData();

      if (job.latitude && job.longitude) {
        return await scoreTransitAccess(job.latitude, job.longitude);
      }
      return undefined;
    });

    if (transit) {
      logger.info(`Transit score: ${transit.score}`);
    }

    // Index to Typesense
    await step.run("index-typesense", async () => {
      const enrichedJob: EnrichedJob = {
        ...job,
        transit,
        shifts,
        secondChance,
      };

      await indexJob(enrichedJob, source);
      logger.info(`Indexed job ${job.id} to Typesense`);
    });

    return {
      jobId: job.id,
      title: job.title,
      company: job.company,
      source,
      shifts,
      secondChance: {
        isSecondChance: secondChance.isSecondChance,
        noBackgroundCheck: secondChance.noBackgroundCheck,
      },
      transit: transit
        ? {
            score: transit.score,
            distance: transit.distanceMiles,
          }
        : null,
    };
  }
);
