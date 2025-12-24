/**
 * Scrape Batch Function
 *
 * Triggered by cron (every 4 hours) or manual invocation.
 * Scrapes job listings, fetches details in batches, and fires batch/process events.
 * Dedup and enrichment are handled by process-batch function.
 */

import {
  scrapeSnagajobListings,
  enrichJobDetails,
  LOCATIONS,
} from "../../scrapers/snagajob";
import { inngest } from "../client";

// South Florida locations to scrape
const SCRAPE_LOCATIONS = [
  { name: "Miami", ...LOCATIONS.miami },
  { name: "Fort Lauderdale", ...LOCATIONS.fortLauderdale },
  { name: "West Palm Beach", ...LOCATIONS.westPalmBeach },
];

export const scrapeBatch = inngest.createFunction(
  {
    id: "scrape-batch",
    concurrency: { limit: 1 }, // Only one scrape at a time
  },
  { cron: "0 */4 * * *" }, // Every 4 hours
  async ({ step, logger }) => {
    logger.info("Starting scrape batch...");

    let totalBatchesSent = 0;
    let totalJobsScraped = 0;

    for (const loc of SCRAPE_LOCATIONS) {
      const result = await step.run(
        `scrape-${loc.name.toLowerCase().replace(/\s+/g, "-")}`,
        async () => {
          const jobs = await scrapeSnagajobListings({
            latitude: loc.latitude,
            longitude: loc.longitude,
            locationName: loc.name,
            radiusInMiles: 25,
            promotedOnly: false,
            onProgress: (msg) => logger.info(`  ${msg}`),
          });

          logger.info(
            `${loc.name}: ${jobs.length} listings found, fetching details...`
          );

          let batchCount = 0;

          await enrichJobDetails(
            jobs,
            (msg) => logger.info(`  ${msg}`),
            async (batch) => {
              // IMMEDIATE fire using inngest.send() - fires NOW, doesn't wait
              await inngest.send({
                name: "batch/process",
                data: { jobs: [...batch], source: "snagajob" },
              });
              batchCount++;
              logger.info(`🚀 FIRED batch/process (${batch.length} jobs)`);
            }
          );

          return { jobCount: jobs.length, batchCount };
        }
      );

      totalJobsScraped += result.jobCount;
      totalBatchesSent += result.batchCount;
      logger.info(`${loc.name}: ${result.batchCount} batches fired`);
    }

    logger.info(
      `Scrape complete: ${totalJobsScraped} jobs scraped, ${totalBatchesSent} batches fired`
    );

    return {
      totalJobsScraped,
      batchesSent: totalBatchesSent,
      locations: SCRAPE_LOCATIONS.map((l) => l.name),
    };
  }
);
