/**
 * Second-Chance Employer Detection (Legacy Keyword Matcher)
 *
 * Identifies jobs that are friendly to people with criminal backgrounds
 * through keyword matching on job descriptions.
 *
 * NOTE: This is the legacy keyword-based detection. The new multi-signal
 * scorer in second-chance-scorer.ts provides more accurate results.
 */

export interface SecondChanceResult {
  isSecondChance: boolean;
  backgroundCheckRequired: boolean;
  drugTestRequired: boolean | null;
  signals: string[];
}

// Positive signals - employer is open to people with criminal backgrounds
const SECOND_CHANCE_POSITIVE = [
  // Fair Chance Act / Ban the Box (legally required language)
  "consider qualified applicants with arrest and conviction records",
  "consider qualified applicants with criminal histories",
  "will consider for employment qualified applicants with criminal histories",
  "consider employment of qualified applicants with arrest",
  "fair chance ordinance",
  "fair chance initiative",
  "fair chance act",
  "fair chance employer",
  "fair chance hiring",
  "ban the box",

  // Explicit second-chance statements
  "second chance employer",
  "second-chance employer",
  "second chance friendly",
  "felony friendly",
  "felon friendly",
  "we hire felons",
  "felons welcome",
  "felons encouraged to apply",

  // Criminal history assessment language
  "criminal record will not automatically disqualify",
  "criminal history will not automatically disqualify",
  "conviction will not automatically disqualify",
  "criminal record does not disqualify",
  "does not automatically bar",
  "individualized assessment",

  // Inclusive hiring for justice-involved
  "background friendly",
  "all backgrounds welcome",
  "open to all backgrounds",
  "justice-involved",
  "justice involved",
  "formerly incarcerated",
  "returning citizens",
  "reentry program",
  "re-entry program",
  "reentry friendly",
];

// Negative signals - background check is required
const BACKGROUND_CHECK_REQUIRED = [
  "must pass background check",
  "background check required",
  "criminal background check required",
  "subject to background check",
  "contingent upon background check",
  "contingent on background check",
  "pass a background investigation",
  "satisfactory background check",
  "clear background check",
  "background screening required",
  "pre-employment background check",
  "clean background required",
  "clean record required",
  "clean criminal record",
  "no felonies",
  "no felony convictions",
  "no criminal history",
];

// Drug test signals
const DRUG_TEST_REQUIRED = [
  "drug test required",
  "drug screen required",
  "drug-free workplace",
  "pre-employment drug test",
  "must pass drug test",
  "drug screening required",
  "subject to drug test",
];

const DRUG_TEST_NEGATIVE = [
  "no drug test",
  "drug test not required",
];

/**
 * Detect second-chance employer signals in job description
 */
export function detectSecondChance(description: string | undefined): SecondChanceResult {
  if (!description) {
    return {
      isSecondChance: false,
      backgroundCheckRequired: false,
      drugTestRequired: null,
      signals: [],
    };
  }

  const lowerDesc = description.toLowerCase();
  const signals: string[] = [];

  let isSecondChance = false;
  let backgroundCheckRequired = false;
  let drugTestRequired: boolean | null = null;

  // Check positive signals (second-chance friendly)
  for (const phrase of SECOND_CHANCE_POSITIVE) {
    if (lowerDesc.includes(phrase)) {
      isSecondChance = true;
      signals.push(`+${phrase}`);
    }
  }

  // Check background check requirements
  for (const phrase of BACKGROUND_CHECK_REQUIRED) {
    if (lowerDesc.includes(phrase)) {
      backgroundCheckRequired = true;
      signals.push(`-bg:${phrase}`);
    }
  }

  // Check drug test requirements
  for (const phrase of DRUG_TEST_REQUIRED) {
    if (lowerDesc.includes(phrase)) {
      drugTestRequired = true;
      signals.push(`-drug:${phrase}`);
    }
  }

  // Check for no drug test
  for (const phrase of DRUG_TEST_NEGATIVE) {
    if (lowerDesc.includes(phrase)) {
      drugTestRequired = false;
      signals.push(`+nodrug:${phrase}`);
    }
  }

  return {
    isSecondChance,
    backgroundCheckRequired,
    drugTestRequired,
    signals,
  };
}

/**
 * Batch detect second-chance signals for multiple jobs
 */
export function detectSecondChanceBatch(
  jobs: Array<{ id: string; description?: string }>
): Map<string, SecondChanceResult> {
  const results = new Map<string, SecondChanceResult>();

  for (const job of jobs) {
    const result = detectSecondChance(job.description);
    results.set(job.id, result);
  }

  return results;
}
