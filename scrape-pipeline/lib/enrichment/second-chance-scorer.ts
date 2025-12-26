/**
 * Second Chance Job Scoring Module
 *
 * Combines three signals to determine if a job is "second chance" friendly:
 * 1. LLM analysis of job description
 * 2. Known fair-chance employer matching
 * 3. O*NET occupational category
 *
 * This module is standalone with no external dependencies (no Redis, no LLM calls).
 * All signal data is passed in, making it testable with static datasets.
 */

// ============================================================================
// Types
// ============================================================================

export interface SignalResult {
  score: number; // -100 to +100
  confidence: number; // 0 to 1
  signals: string[];
}

export type LLMStance = 'explicitly_fair_chance' | 'explicitly_excludes' | 'unknown';

export interface LLMSignal extends SignalResult {
  stance: LLMStance;
  reasoning: string;
}

export interface EmployerSignal extends SignalResult {
  matchType: 'exact' | 'fuzzy' | 'none';
  matchedName?: string;
  similarity?: number;
}

export interface OnetSignal extends SignalResult {
  majorGroup: string;
  isRestrictedOccupation: boolean;
}

export interface SecondChanceScore {
  score: number; // 0-100 final score
  tier: 'high' | 'medium' | 'low' | 'unlikely' | 'unknown';
  confidence: number; // 0-1 overall confidence
  signals: string[];
  reasoning: string;
  debug?: {
    llmContribution: number;
    employerContribution: number;
    onetContribution: number;
    overrideApplied?: string;
  };
}

export interface ScoringInput {
  llm: LLMSignal;
  employer: EmployerSignal;
  onet: OnetSignal;
}

// ============================================================================
// O*NET Scoring Tables
// ============================================================================

/**
 * Major group scores: adjustment from neutral (0)
 * Positive = more likely to hire, Negative = less likely
 */
export const ONET_MAJOR_GROUP_SCORES: Record<string, number> = {
  // Favorable - entry-level, skills-based, known to hire
  '35': 15, // Food Preparation & Serving
  '37': 12, // Building & Grounds Cleaning
  '47': 15, // Construction & Extraction
  '49': 10, // Installation, Maintenance, Repair
  '51': 12, // Production (Manufacturing)
  '53': 10, // Transportation & Material Moving

  // Neutral
  '39': 0, // Personal Care & Service
  '41': 0, // Sales
  '43': 0, // Office & Administrative
  '45': 5, // Farming, Fishing, Forestry

  // Unfavorable - licensed, regulated, background-sensitive
  '11': -5, // Management
  '13': -5, // Business & Financial
  '15': 0, // Computer & Math (varies widely)
  '17': -5, // Architecture & Engineering
  '19': -5, // Life, Physical, Social Science
  '21': -10, // Community & Social Service (vulnerable populations)
  '23': -15, // Legal
  '25': -20, // Education (children)
  '27': 0, // Arts, Design, Entertainment
  '29': -15, // Healthcare Practitioners
  '31': -5, // Healthcare Support
  '33': -25, // Protective Services (law enforcement)
};

/**
 * Specific occupations with known restrictions
 * These are legally barred for felons in most jurisdictions
 */
export const RESTRICTED_OCCUPATIONS = new Set([
  '33-3051', // Police Officers
  '33-3012', // Correctional Officers
  '33-1012', // First-Line Supervisors of Police
  '33-3021', // Detectives and Criminal Investigators
  '33-3011', // Bailiffs
  '33-1011', // First-Line Supervisors of Correctional Officers
  '33-9021', // Private Detectives and Investigators
]);

/**
 * Occupations known to be more open to hiring
 */
export const FAVORABLE_OCCUPATIONS = new Set([
  '35-2014', // Cooks, Restaurant
  '35-2021', // Food Preparation Workers
  '35-3023', // Fast Food and Counter Workers
  '53-7062', // Laborers and Freight, Stock, and Material Movers
  '53-7065', // Stockers and Order Fillers
  '47-2061', // Construction Laborers
  '47-2051', // Cement Masons
  '47-2031', // Carpenters
  '51-9198', // Helpers--Production Workers
  '37-2011', // Janitors and Cleaners
  '37-3011', // Landscaping and Groundskeeping Workers
]);

// ============================================================================
// Scoring Configuration
// ============================================================================

export interface ScoringConfig {
  weights: {
    llm: number;
    employer: number;
    onet: number;
  };
  thresholds: {
    high: number;
    medium: number;
    low: number;
  };
  minConfidenceForSignal: number;
  corroborationBoost: number;
  knownEmployerFloor: number;
}

export const DEFAULT_CONFIG: ScoringConfig = {
  weights: {
    llm: 50,
    employer: 35,
    onet: 15,
  },
  thresholds: {
    high: 75,
    medium: 55,
    low: 35,
  },
  minConfidenceForSignal: 0.3,
  corroborationBoost: 1.1,
  knownEmployerFloor: 60,
};

// ============================================================================
// Core Scoring Function
// ============================================================================

export function computeSecondChanceScore(
  input: ScoringInput,
  config: ScoringConfig = DEFAULT_CONFIG
): SecondChanceScore {
  const { llm, employer, onet } = input;

  // ═══════════════════════════════════════════════════════════════════════════
  // INPUT VALIDATION
  // ═══════════════════════════════════════════════════════════════════════════
  if (employer.similarity !== undefined && (employer.similarity < 0 || employer.similarity > 1)) {
    throw new Error(`Invalid employer similarity: ${employer.similarity} (must be 0-1)`);
  }

  const allSignals = [...llm.signals, ...employer.signals, ...onet.signals];

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 1: LLM explicitly_excludes - HARD OVERRIDE (nothing can override this)
  // ═══════════════════════════════════════════════════════════════════════════
  if (llm.stance === 'explicitly_excludes') {
    return {
      score: 10,
      tier: 'unlikely',
      confidence: 0.95,
      signals: [...allSignals, 'OVERRIDE:explicitly_excludes'],
      reasoning: `Job explicitly excludes candidates with criminal history: ${llm.reasoning}`,
      debug: {
        llmContribution: 10,
        employerContribution: 0,
        onetContribution: 0,
        overrideApplied: 'explicitly_excludes',
      },
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 2: O*NET restricted occupation - second-highest priority
  // ═══════════════════════════════════════════════════════════════════════════
  if (onet.isRestrictedOccupation) {
    return {
      score: 15,
      tier: 'unlikely',
      confidence: 0.9,
      signals: [...allSignals, 'OVERRIDE:restricted_occupation'],
      reasoning: `${onet.majorGroup} occupations typically bar felony convictions`,
      debug: {
        llmContribution: 0,
        employerContribution: 0,
        onetContribution: 15,
        overrideApplied: 'restricted_occupation',
      },
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 3: LLM explicitly_fair_chance - strong positive
  // ═══════════════════════════════════════════════════════════════════════════
  if (llm.stance === 'explicitly_fair_chance') {
    // Base score 85, boost to 90 if employer is a known fair-chance employer
    const hasEmployerMatch = employer.matchType !== 'none';
    const score = hasEmployerMatch ? 90 : 85;

    if (hasEmployerMatch) {
      allSignals.push('BOOST:employer_corroboration');
    }

    return {
      score,
      tier: 'high',
      confidence: 0.9,
      signals: [...allSignals, 'OVERRIDE:explicitly_fair_chance'],
      reasoning: `Job explicitly states fair chance hiring: ${llm.reasoning}`,
      debug: {
        llmContribution: 85,
        employerContribution: hasEmployerMatch ? 5 : 0,
        onetContribution: 0,
        overrideApplied: 'explicitly_fair_chance',
      },
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 4: LLM unknown - use employer (70%) + O*NET (30%) heuristics only
  // ═══════════════════════════════════════════════════════════════════════════

  // Weighted average of employer and O*NET only (LLM provides no signal)
  const employerWeight = 0.7;
  const onetWeight = 0.3;

  // Adjust weights based on confidence
  const employerContrib = employer.score * employerWeight * employer.confidence;
  const onetContrib = onet.score * onetWeight * onet.confidence;
  const totalWeight = employerWeight * employer.confidence + onetWeight * onet.confidence;

  // If we have no confident signals, return unknown
  if (totalWeight < 0.1) {
    return {
      score: 50,
      tier: 'unknown',
      confidence: 0.1,
      signals: [...allSignals, 'INSUFFICIENT_DATA'],
      reasoning: 'No confident signals available to make an assessment',
      debug: {
        llmContribution: 0,
        employerContribution: 0,
        onetContribution: 0,
      },
    };
  }

  const rawScore = (employerContrib + onetContrib) / totalWeight;
  const score = Math.round(Math.max(0, Math.min(100, rawScore)));
  const confidence = Math.min(0.7, totalWeight); // Cap confidence since LLM gave no signal

  const tier = scoreTier(score, config);

  return {
    score,
    tier,
    confidence,
    signals: allSignals,
    reasoning: generateReasoning(input, score),
    debug: {
      llmContribution: 0, // LLM contributed nothing (unknown stance)
      employerContribution: Math.round(employerContrib / totalWeight),
      onetContribution: Math.round(onetContrib / totalWeight),
    },
  };
}

// ============================================================================
// Helper Functions
// ============================================================================

function scoreTier(
  score: number,
  config: ScoringConfig
): 'high' | 'medium' | 'low' | 'unlikely' | 'unknown' {
  if (score >= config.thresholds.high) return 'high';
  if (score >= config.thresholds.medium) return 'medium';
  if (score >= config.thresholds.low) return 'low';
  return 'unlikely';
}

function generateReasoning(input: ScoringInput, finalScore: number): string {
  const { employer, onet } = input;
  const parts: string[] = [];

  // Employer reasoning
  if (employer.matchType === 'exact') {
    parts.push(`${employer.matchedName || 'Employer'} is a known fair chance employer`);
  } else if (employer.matchType === 'fuzzy') {
    parts.push(`Employer likely matches known fair chance employer`);
  }

  // O*NET reasoning
  if (onet.score > 60) {
    parts.push(`${onet.majorGroup} industry typically hires second chance candidates`);
  } else if (onet.score < 40) {
    parts.push(`${onet.majorGroup} industry may have restrictions`);
  }

  if (parts.length === 0) {
    if (finalScore >= 55) {
      return 'Employer/industry signals suggest this may be second-chance friendly';
    } else if (finalScore <= 45) {
      return 'Limited information available; proceed with caution';
    }
    return 'No explicit signals; based on employer and industry heuristics';
  }

  return parts.join('; ');
}

// ============================================================================
// O*NET Signal Generator (for testing without external dependencies)
// ============================================================================

// O*NET code format: XX-XXXX or XX-XXXX.XX (e.g., "35-2014" or "35-2014.00")
const ONET_CODE_PATTERN = /^\d{2}-\d{4}(\.\d{2})?$/;

export function generateOnetSignal(onetCode: string | undefined): OnetSignal {
  if (!onetCode || !ONET_CODE_PATTERN.test(onetCode)) {
    return {
      score: 50,
      confidence: 0.2,
      signals: ['onet:missing'],
      majorGroup: 'unknown',
      isRestrictedOccupation: false,
    };
  }

  const majorGroup = onetCode.substring(0, 2);
  const detailedCode = onetCode.substring(0, 7);

  // Check for restricted occupations
  if (RESTRICTED_OCCUPATIONS.has(detailedCode)) {
    return {
      score: 10,
      confidence: 0.9,
      signals: [`onet:restricted:${detailedCode}`],
      majorGroup,
      isRestrictedOccupation: true,
    };
  }

  // Check for favorable occupations
  if (FAVORABLE_OCCUPATIONS.has(detailedCode)) {
    return {
      score: 75,
      confidence: 0.8,
      signals: [`onet:favorable:${detailedCode}`],
      majorGroup,
      isRestrictedOccupation: false,
    };
  }

  // Use major group scoring
  const groupScore = ONET_MAJOR_GROUP_SCORES[majorGroup] ?? 0;

  return {
    score: 50 + groupScore,
    confidence: 0.7,
    signals: [`onet:group:${majorGroup}:${groupScore >= 0 ? '+' : ''}${groupScore}`],
    majorGroup,
    isRestrictedOccupation: false,
  };
}

// ============================================================================
// Employer Signal Generator (for testing without Redis)
// ============================================================================

export interface EmployerLookupResult {
  found: boolean;
  matchType: 'exact' | 'fuzzy' | 'none';
  matchedName?: string;
  similarity?: number;
}

export function generateEmployerSignal(lookup: EmployerLookupResult): EmployerSignal {
  // Validate similarity if present
  if (lookup.similarity !== undefined && (lookup.similarity < 0 || lookup.similarity > 1)) {
    throw new Error(`Invalid employer similarity: ${lookup.similarity} (must be 0-1)`);
  }

  if (lookup.matchType === 'exact') {
    return {
      score: 80,
      confidence: 0.95,
      signals: [`employer:exact:${lookup.matchedName}`],
      matchType: 'exact',
      matchedName: lookup.matchedName,
    };
  }

  if (lookup.matchType === 'fuzzy' && lookup.similarity && lookup.similarity > 0.85) {
    return {
      score: 70,
      confidence: 0.8,
      signals: [`employer:fuzzy:${lookup.matchedName}:${lookup.similarity.toFixed(2)}`],
      matchType: 'fuzzy',
      matchedName: lookup.matchedName,
      similarity: lookup.similarity,
    };
  }

  // Unknown employer - neutral, low confidence (won't drag score down)
  return {
    score: 50,
    confidence: 0.3,
    signals: ['employer:unknown'],
    matchType: 'none',
  };
}

// ============================================================================
// LLM Signal Generator (for testing - simulates LLM output)
// ============================================================================

export interface LLMAnalysisResult {
  stance: LLMStance;
  reasoning: string;
}

export function generateLLMSignal(analysis: LLMAnalysisResult): LLMSignal {
  const { stance, reasoning } = analysis;

  // Convert stance to score and confidence
  switch (stance) {
    case 'explicitly_excludes':
      return {
        score: 0,
        confidence: 0.95,
        signals: ['llm:explicitly_excludes'],
        stance,
        reasoning,
      };

    case 'explicitly_fair_chance':
      return {
        score: 85,
        confidence: 0.9,
        signals: ['llm:explicitly_fair_chance'],
        stance,
        reasoning,
      };

    case 'unknown':
    default:
      return {
        score: 50,
        confidence: 0.2, // Low confidence - no clear signal
        signals: ['llm:unknown'],
        stance,
        reasoning,
      };
  }
}

// ============================================================================
// Test Utilities
// ============================================================================

export interface TestCase {
  name: string;
  description: string;
  input: ScoringInput;
  expectedTier: 'high' | 'medium' | 'low' | 'unlikely' | 'unknown';
  expectedScoreRange?: [number, number];
}

export function runTestCase(
  testCase: TestCase,
  config: ScoringConfig = DEFAULT_CONFIG
): {
  passed: boolean;
  result: SecondChanceScore;
  errors: string[];
} {
  const result = computeSecondChanceScore(testCase.input, config);
  const errors: string[] = [];

  if (result.tier !== testCase.expectedTier) {
    errors.push(`Expected tier '${testCase.expectedTier}', got '${result.tier}'`);
  }

  if (testCase.expectedScoreRange) {
    const [min, max] = testCase.expectedScoreRange;
    if (result.score < min || result.score > max) {
      errors.push(`Expected score ${min}-${max}, got ${result.score}`);
    }
  }

  return {
    passed: errors.length === 0,
    result,
    errors,
  };
}

export function runTestSuite(
  testCases: TestCase[],
  config: ScoringConfig = DEFAULT_CONFIG
): {
  passed: number;
  failed: number;
  results: Array<{ testCase: TestCase; passed: boolean; result: SecondChanceScore; errors: string[] }>;
} {
  const results = testCases.map((tc) => ({
    testCase: tc,
    ...runTestCase(tc, config),
  }));

  return {
    passed: results.filter((r) => r.passed).length,
    failed: results.filter((r) => !r.passed).length,
    results,
  };
}
