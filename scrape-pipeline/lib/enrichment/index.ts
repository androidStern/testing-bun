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

// Legacy keyword-based detection (deprecated - use second-chance-scorer instead)
export { detectSecondChance, detectSecondChanceBatch } from "./second-chance";
export type { SecondChanceResult } from "./second-chance";

// Second-chance scoring (multi-signal approach)
export {
  computeSecondChanceScore,
  generateLLMSignal,
  generateEmployerSignal,
  generateOnetSignal,
  runTestCase,
  runTestSuite,
  DEFAULT_CONFIG,
} from "./second-chance-scorer";
export type {
  SecondChanceScore,
  ScoringInput,
  LLMSignal,
  EmployerSignal,
  OnetSignal,
  ScoringConfig,
  TestCase,
} from "./second-chance-scorer";

export { analyzeJobForSecondChance, analyzeJobForSecondChanceSafe } from "./second-chance-llm";
export type { SecondChanceLLMAnalysis } from "./second-chance-llm";

export { lookupFairChanceEmployer, getEmployerSignal } from "./second-chance-employer";

import type { SnagajobJob } from "../../scrapers/snagajob";
import type { TransitScore } from "../../transit-scorer";
import { extractShifts, type ShiftResult } from "./shift-extractor";
import type { SecondChanceScore } from "./second-chance-scorer";

export interface EnrichmentResult {
  shifts: ShiftResult;
  secondChanceScore?: SecondChanceScore;
  transit?: TransitScore;
}

/**
 * Extract shifts from a single job.
 * Second-chance scoring is now done separately via the multi-signal scorer.
 */
export async function enrichJob(
  job: SnagajobJob
): Promise<{ shifts: ShiftResult }> {
  const shifts = await extractShifts({
    id: job.id,
    title: job.title,
    description: job.descriptionText,
    workSchedule: job.workSchedule,
  });

  return { shifts };
}

/**
 * Extract shifts from multiple jobs in batch
 */
export async function enrichJobs(
  jobs: SnagajobJob[]
): Promise<Map<string, { shifts: ShiftResult }>> {
  const results = new Map<string, { shifts: ShiftResult }>();

  for (const job of jobs) {
    const result = await enrichJob(job);
    results.set(job.id, result);
  }

  return results;
}
