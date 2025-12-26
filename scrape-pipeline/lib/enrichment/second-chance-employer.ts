/**
 * Employer Signal Generation for Second-Chance Scoring
 *
 * Wraps the Redis-based fair-chance employer lookup to generate
 * signals compatible with the second-chance-scorer module.
 */

import {
  isFairChanceEmployer,
  getFairChanceEmployer,
} from '../../fair-chance-employers';
import {
  generateEmployerSignal,
  type EmployerSignal,
  type EmployerLookupResult,
} from './second-chance-scorer';

/**
 * Look up an employer in the fair-chance Redis database
 *
 * @param companyName Company name from job posting
 * @returns Lookup result for signal generation
 */
export async function lookupFairChanceEmployer(
  companyName: string
): Promise<EmployerLookupResult> {
  if (!companyName || companyName.trim().length === 0) {
    return {
      found: false,
      matchType: 'none',
    };
  }

  // Let Redis errors propagate - Inngest will retry
  // Don't swallow errors as that masks real problems
  const isKnown = await isFairChanceEmployer(companyName);

  if (isKnown) {
    // Get additional details for audit trail
    const details = await getFairChanceEmployer(companyName);
    return {
      found: true,
      matchType: 'exact',
      matchedName: details?.name || companyName,
    };
  }

  // TODO: Future enhancement - fuzzy matching using company-matching algorithms
  // For now, just return no match if exact normalized match fails

  return {
    found: false,
    matchType: 'none',
  };
}

/**
 * Generate an employer signal for the second-chance scorer
 *
 * Combines Redis lookup with signal generation in one call.
 *
 * @param companyName Company name from job posting
 * @returns EmployerSignal for scoring
 */
export async function getEmployerSignal(companyName: string): Promise<EmployerSignal> {
  const lookup = await lookupFairChanceEmployer(companyName);
  return generateEmployerSignal(lookup);
}
