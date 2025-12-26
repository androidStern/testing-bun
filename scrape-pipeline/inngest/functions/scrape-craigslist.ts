/**
 * Scrape Craigslist Function
 *
 * Triggered by cron (every 4 hours, offset from Snagajob) or manual invocation.
 * Scrapes job listings from Craigslist South Florida, fetches details in batches,
 * and fires batch/process events for the shared pipeline.
 */

import {
  CATEGORIES,
  REGIONS,
  closeBrowser,
  enrichJobDetails,
  scrapeCraigslistListings,
  type CategoryCode,
  type CraigslistJob,
  type RegionCode,
} from '../../scrapers/craigslist';
import { inngest } from '../client';

const REGION_CODES = Object.keys(REGIONS) as Array<RegionCode>;
const CATEGORY_CODES = Object.keys(CATEGORIES) as Array<CategoryCode>;

export const scrapeCraigslist = inngest.createFunction(
  {
    id: 'scrape-craigslist',
    concurrency: { limit: 1 },
    retries: 3,
  },
  { cron: '30 */4 * * *' },
  async ({ step, logger }) => {
    logger.info(`Starting Craigslist scrape - regions: ${REGION_CODES.join(', ')}, categories: ${CATEGORY_CODES.join(', ')}`);

    try {
      // Step 1: Scrape all regions and categories
      const allJobs: Array<CraigslistJob> = [];

      for (const category of CATEGORY_CODES) {
        const categoryName = CATEGORIES[category];
        for (const region of REGION_CODES) {
          const regionName = REGIONS[region];
          const jobs = await step.run(`scrape-${region}-${category}`, async () => {
            return await scrapeCraigslistListings({
              region,
              category,
              onProgress: (msg) => logger.info(`  ${msg}`),
            });
          });
          logger.info(`${regionName} ${categoryName}s: ${jobs.length} listings`);
          allJobs.push(...jobs);
        }
      }

      // Step 2: Dedupe by external ID (Craigslist cross-posts to multiple regions)
      const seen = new Set<string>();
      const uniqueJobs = allJobs.filter((job) => {
        if (seen.has(job.id)) return false;
        seen.add(job.id);
        return true;
      });
      logger.info(`Deduped: ${allJobs.length} → ${uniqueJobs.length} unique jobs`);

      // Step 3: Enrich and send to pipeline
      let batchesSent = 0;

      await step.run('enrich-and-process', async () => {
        await enrichJobDetails(
          uniqueJobs,
          (msg) => logger.info(`  ${msg}`),
          async (batch) => {
            await inngest.send({
              name: 'batch/process',
              data: { jobs: [...batch], source: 'craigslist' },
            });
            batchesSent++;
            logger.info(`🚀 FIRED batch/process (${batch.length} jobs)`);
          },
          10,
        );
      });

      logger.info(`Complete: ${uniqueJobs.length} unique jobs, ${batchesSent} batches`);

      return {
        totalScraped: allJobs.length,
        uniqueJobs: uniqueJobs.length,
        batchesSent,
      };
    } finally {
      await closeBrowser();
    }
  },
);
