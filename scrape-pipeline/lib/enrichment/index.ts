/**
 * Enrichment Module
 *
 * Combines all enrichment capabilities:
 * - Shift timing extraction
 * - Second-chance employer detection
 * - Transit scoring (from existing transit-scorer.ts)
 */

export { extractShifts, extractShiftsBatch } from "./shift-extractor";
export type { ShiftResult, JobInput } from "./shift-extractor";

export { detectSecondChance, detectSecondChanceBatch } from "./second-chance";
export type { SecondChanceResult } from "./second-chance";

import type { SnagajobJob } from "../../scrapers/snagajob";
import type { TransitScore } from "../../transit-scorer";
import { extractShifts, type ShiftResult } from "./shift-extractor";
import { detectSecondChance, type SecondChanceResult } from "./second-chance";

export interface EnrichmentResult {
  shifts: ShiftResult;
  secondChance: SecondChanceResult;
  transit?: TransitScore;
}

/**
 * Enrich a single job with all available enrichments
 * (except transit, which requires batch processing for efficiency)
 */
export async function enrichJob(
  job: SnagajobJob
): Promise<{ shifts: ShiftResult; secondChance: SecondChanceResult }> {
  const shifts = await extractShifts({
    id: job.id,
    title: job.title,
    description: job.descriptionText,
    workSchedule: job.workSchedule,
  });

  const secondChance = detectSecondChance(job.descriptionText);

  return { shifts, secondChance };
}

/**
 * Enrich multiple jobs in batch
 */
export async function enrichJobs(
  jobs: SnagajobJob[]
): Promise<Map<string, { shifts: ShiftResult; secondChance: SecondChanceResult }>> {
  const results = new Map<
    string,
    { shifts: ShiftResult; secondChance: SecondChanceResult }
  >();

  for (const job of jobs) {
    const result = await enrichJob(job);
    results.set(job.id, result);
  }

  return results;
}
