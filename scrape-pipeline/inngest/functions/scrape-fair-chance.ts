/**
 * Inngest scheduled function to scrape Florida fair chance employers daily.
 * Populates Redis with employer data for fast lookups.
 * Returns comprehensive stats for run verification.
 */

import { inngest } from "../client";
import {
	scrapeFairChanceEmployers,
	getFairChanceRedisStats,
} from "../../fair-chance-employers";

export const scrapeFairChance = inngest.createFunction(
	{
		id: "scrape-fair-chance",
		concurrency: { limit: 1 }, // Only one scrape at a time
		retries: 2,
	},
	{ cron: "0 6 * * *" }, // Daily at 6 AM UTC (1-2 AM EST)
	async ({ step, logger }) => {
		// Get Redis stats BEFORE scrape
		const statsBefore = await step.run("get-stats-before", async () => {
			return getFairChanceRedisStats();
		});

		logger.info(
			`Redis before: ${statsBefore.totalEmployers} employers, ${statsBefore.employersStale30Days} stale 30d+`
		);

		// Run the scrape
		const result = await step.run("scrape-employers", async () => {
			return scrapeFairChanceEmployers({
				storeToRedis: true,
				onProgress: (msg) => logger.info(msg),
			});
		});

		// Get Redis stats AFTER scrape
		const statsAfter = await step.run("get-stats-after", async () => {
			return getFairChanceRedisStats();
		});

		logger.info(
			`Redis after: ${statsAfter.totalEmployers} employers, ${statsAfter.employersSeenToday} touched today`
		);

		logger.info(
			`Fair chance scrape complete: ${result.employers.length} employers, ${result.stats.newEmployers} new, ${result.stats.existingEmployersTouched} touched`
		);

		return {
			scrapedAt: new Date().toISOString(),
			scrape: result.stats,
			redisBefore: statsBefore,
			redisAfter: statsAfter,
			delta: {
				newEmployersAdded: statsAfter.totalEmployers - statsBefore.totalEmployers,
				employersTouchedThisRun:
					result.stats.newEmployers + result.stats.existingEmployersTouched,
			},
		};
	}
);
