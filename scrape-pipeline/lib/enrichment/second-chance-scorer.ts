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
  score: number // -100 to +100
  confidence: number // 0 to 1
  signals: string[]
}

export type LLMStance = 'fair_chance' | 'likely_excludes' | 'unknown'

export interface LLMSignal extends SignalResult {
  stance: LLMStance
  reasoning: string
}

export interface EmployerSignal extends SignalResult {
  matchType: 'exact' | 'fuzzy' | 'none'
  matchedName?: string
  similarity?: number
}

export interface OnetSignal extends SignalResult {
  majorGroup: string
  isRestrictedOccupation: boolean
}

export interface SecondChanceScore {
  score: number // 0-100 final score
  tier: 'high' | 'medium' | 'low' | 'unlikely' | 'unknown'
  confidence: number // 0-1 overall confidence
  signals: string[]
  reasoning: string
  debug?: {
    llmContribution: number
    employerContribution: number
    onetContribution: number
    overrideApplied?: string
  }
}

export interface ScoringInput {
  llm: LLMSignal
  employer: EmployerSignal
  onet: OnetSignal
}

// ============================================================================
// O*NET Scoring Tables
// ============================================================================

/**
 * Major group scores: adjustment from neutral (0)
 * Positive = more likely to hire, Negative = less likely
 */
export const ONET_MAJOR_GROUP_SCORES: Record<string, number> = {
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
  // Favorable - entry-level, skills-based, known to hire
  '35': 15, // Food Preparation & Serving
  '37': 12, // Building & Grounds Cleaning

  // Neutral
  '39': 0, // Personal Care & Service
  '41': 0, // Sales
  '43': 0, // Office & Administrative
  '45': 5, // Farming, Fishing, Forestry
  '47': 15, // Construction & Extraction
  '49': 10, // Installation, Maintenance, Repair
  '51': 12, // Production (Manufacturing)
  '53': 10, // Transportation & Material Moving
}

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
])

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
])

// ============================================================================
// Scoring Configuration
// ============================================================================

export interface ScoringConfig {
  weights: {
    llm: number
    employer: number
    onet: number
  }
  thresholds: {
    high: number
    medium: number
    low: number
  }
  minConfidenceForSignal: number
  corroborationBoost: number
  knownEmployerFloor: number
}

export const DEFAULT_CONFIG: ScoringConfig = {
  corroborationBoost: 1.1,
  knownEmployerFloor: 60,
  minConfidenceForSignal: 0.3,
  thresholds: {
    high: 75,
    low: 35,
    medium: 55,
  },
  weights: {
    employer: 35,
    llm: 50,
    onet: 15,
  },
}

// ============================================================================
// Core Scoring Function
// ============================================================================

export function computeSecondChanceScore(
  input: ScoringInput,
  config: ScoringConfig = DEFAULT_CONFIG,
): SecondChanceScore {
  const { llm, employer, onet } = input

  // ═══════════════════════════════════════════════════════════════════════════
  // INPUT VALIDATION
  // ═══════════════════════════════════════════════════════════════════════════
  if (employer.similarity !== undefined && (employer.similarity < 0 || employer.similarity > 1)) {
    throw new Error(`Invalid employer similarity: ${employer.similarity} (must be 0-1)`)
  }

  const allSignals = [...llm.signals, ...employer.signals, ...onet.signals]

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 1: LLM likely_excludes - HARD OVERRIDE (nothing can override this)
  // ═══════════════════════════════════════════════════════════════════════════
  if (llm.stance === 'likely_excludes') {
    return {
      confidence: 0.95,
      debug: {
        employerContribution: 0,
        llmContribution: 10,
        onetContribution: 0,
        overrideApplied: 'likely_excludes',
      },
      reasoning: `Job likely excludes candidates with criminal history: ${llm.reasoning}`,
      score: 10,
      signals: [...allSignals, 'OVERRIDE:likely_excludes'],
      tier: 'unlikely',
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 2: O*NET restricted occupation - second-highest priority
  // ═══════════════════════════════════════════════════════════════════════════
  if (onet.isRestrictedOccupation) {
    return {
      confidence: 0.9,
      debug: {
        employerContribution: 0,
        llmContribution: 0,
        onetContribution: 15,
        overrideApplied: 'restricted_occupation',
      },
      reasoning: `${onet.majorGroup} occupations typically bar felony convictions`,
      score: 15,
      signals: [...allSignals, 'OVERRIDE:restricted_occupation'],
      tier: 'unlikely',
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 3: LLM fair_chance - strong positive
  // ═══════════════════════════════════════════════════════════════════════════
  if (llm.stance === 'fair_chance') {
    // Base score 85, boost to 90 if employer is a known fair-chance employer
    const hasEmployerMatch = employer.matchType !== 'none'
    const score = hasEmployerMatch ? 90 : 85

    if (hasEmployerMatch) {
      allSignals.push('BOOST:employer_corroboration')
    }

    return {
      confidence: 0.9,
      debug: {
        employerContribution: hasEmployerMatch ? 5 : 0,
        llmContribution: 85,
        onetContribution: 0,
        overrideApplied: 'fair_chance',
      },
      reasoning: `Job explicitly states fair chance hiring: ${llm.reasoning}`,
      score,
      signals: [...allSignals, 'OVERRIDE:fair_chance'],
      tier: 'high',
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 4: LLM unknown - use employer (70%) + O*NET (30%) heuristics only
  // ═══════════════════════════════════════════════════════════════════════════

  // Weighted average of employer and O*NET only (LLM provides no signal)
  const employerWeight = 0.7
  const onetWeight = 0.3

  // Adjust weights based on confidence
  const employerContrib = employer.score * employerWeight * employer.confidence
  const onetContrib = onet.score * onetWeight * onet.confidence
  const totalWeight = employerWeight * employer.confidence + onetWeight * onet.confidence

  // If we have no confident signals, return unknown
  // Threshold 0.4 means we need meaningful signal strength to make a classification
  // e.g., LLM unknown + employer none + neutral O*NET group → unknown tier
  if (totalWeight < 0.4) {
    return {
      confidence: 0.1,
      debug: {
        employerContribution: 0,
        llmContribution: 0,
        onetContribution: 0,
      },
      reasoning: 'No confident signals available to make an assessment',
      score: 50,
      signals: [...allSignals, 'INSUFFICIENT_DATA'],
      tier: 'unknown',
    }
  }

  const rawScore = (employerContrib + onetContrib) / totalWeight
  const score = Math.round(Math.max(0, Math.min(100, rawScore)))
  const confidence = Math.min(0.7, totalWeight) // Cap confidence since LLM gave no signal

  const tier = scoreTier(score, config)

  return {
    confidence,
    debug: {
      employerContribution: Math.round(employerContrib / totalWeight),
      llmContribution: 0, // LLM contributed nothing (unknown stance)
      onetContribution: Math.round(onetContrib / totalWeight),
    },
    reasoning: generateReasoning(input, score),
    score,
    signals: allSignals,
    tier,
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

function scoreTier(
  score: number,
  config: ScoringConfig,
): 'high' | 'medium' | 'low' | 'unlikely' | 'unknown' {
  if (score >= config.thresholds.high) return 'high'
  if (score >= config.thresholds.medium) return 'medium'
  if (score >= config.thresholds.low) return 'low'
  return 'unlikely'
}

function generateReasoning(input: ScoringInput, finalScore: number): string {
  const { employer, onet } = input
  const parts: string[] = []

  // Employer reasoning
  if (employer.matchType === 'exact') {
    parts.push(`${employer.matchedName || 'Employer'} is a known fair chance employer`)
  } else if (employer.matchType === 'fuzzy') {
    parts.push(`Employer likely matches known fair chance employer`)
  }

  // O*NET reasoning
  if (onet.score > 60) {
    parts.push(`${onet.majorGroup} industry typically hires second chance candidates`)
  } else if (onet.score < 40) {
    parts.push(`${onet.majorGroup} industry may have restrictions`)
  }

  if (parts.length === 0) {
    if (finalScore >= 55) {
      return 'Employer/industry signals suggest this may be second-chance friendly'
    } else if (finalScore <= 45) {
      return 'Limited information available; proceed with caution'
    }
    return 'No explicit signals; based on employer and industry heuristics'
  }

  return parts.join('; ')
}

// ============================================================================
// O*NET Signal Generator (for testing without external dependencies)
// ============================================================================

// O*NET code format: XX-XXXX or XX-XXXX.XX (e.g., "35-2014" or "35-2014.00")
const ONET_CODE_PATTERN = /^\d{2}-\d{4}(\.\d{2})?$/

export function generateOnetSignal(onetCode: string | undefined): OnetSignal {
  if (!onetCode || !ONET_CODE_PATTERN.test(onetCode)) {
    return {
      confidence: 0.2,
      isRestrictedOccupation: false,
      majorGroup: 'unknown',
      score: 50,
      signals: ['onet:missing'],
    }
  }

  const majorGroup = onetCode.substring(0, 2)
  const detailedCode = onetCode.substring(0, 7)

  // Check for restricted occupations
  if (RESTRICTED_OCCUPATIONS.has(detailedCode)) {
    return {
      confidence: 0.9,
      isRestrictedOccupation: true,
      majorGroup,
      score: 10,
      signals: [`onet:restricted:${detailedCode}`],
    }
  }

  // Check for favorable occupations
  if (FAVORABLE_OCCUPATIONS.has(detailedCode)) {
    return {
      confidence: 0.8,
      isRestrictedOccupation: false,
      majorGroup,
      score: 75,
      signals: [`onet:favorable:${detailedCode}`],
    }
  }

  // Use major group scoring
  const groupScore = ONET_MAJOR_GROUP_SCORES[majorGroup] ?? 0

  // Confidence based on how informative the group score is:
  // - Strong signals (>= +10 or <= -15): high confidence (0.7)
  // - Weak/neutral signals (-10 < score < +10): low confidence (0.3)
  const isStrongSignal = groupScore >= 10 || groupScore <= -15
  const confidence = isStrongSignal ? 0.7 : 0.3

  return {
    confidence,
    isRestrictedOccupation: false,
    majorGroup,
    score: 50 + groupScore,
    signals: [`onet:group:${majorGroup}:${groupScore >= 0 ? '+' : ''}${groupScore}`],
  }
}

// ============================================================================
// Employer Signal Generator (for testing without Redis)
// ============================================================================

export interface EmployerLookupResult {
  found: boolean
  matchType: 'exact' | 'fuzzy' | 'none'
  matchedName?: string
  similarity?: number
}

export function generateEmployerSignal(lookup: EmployerLookupResult): EmployerSignal {
  // Validate similarity if present
  if (lookup.similarity !== undefined && (lookup.similarity < 0 || lookup.similarity > 1)) {
    throw new Error(`Invalid employer similarity: ${lookup.similarity} (must be 0-1)`)
  }

  if (lookup.matchType === 'exact') {
    return {
      confidence: 0.95,
      matchedName: lookup.matchedName,
      matchType: 'exact',
      score: 80,
      signals: [`employer:exact:${lookup.matchedName}`],
    }
  }

  if (lookup.matchType === 'fuzzy' && lookup.similarity && lookup.similarity > 0.85) {
    return {
      confidence: 0.8,
      matchedName: lookup.matchedName,
      matchType: 'fuzzy',
      score: 70,
      signals: [`employer:fuzzy:${lookup.matchedName}:${lookup.similarity.toFixed(2)}`],
      similarity: lookup.similarity,
    }
  }

  // Unknown employer - neutral, low confidence (won't drag score down)
  return {
    confidence: 0.3,
    matchType: 'none',
    score: 50,
    signals: ['employer:unknown'],
  }
}

// ============================================================================
// LLM Signal Generator (for testing - simulates LLM output)
// ============================================================================

export interface LLMAnalysisResult {
  stance: LLMStance
  reasoning: string
}

export function generateLLMSignal(analysis: LLMAnalysisResult): LLMSignal {
  const { stance, reasoning } = analysis

  // Convert stance to score and confidence
  switch (stance) {
    case 'likely_excludes':
      return {
        confidence: 0.95,
        reasoning,
        score: 0,
        signals: ['llm:likely_excludes'],
        stance,
      }

    case 'fair_chance':
      return {
        confidence: 0.9,
        reasoning,
        score: 85,
        signals: ['llm:fair_chance'],
        stance,
      }

    case 'unknown':
    default:
      return {
        confidence: 0.2, // Low confidence - no clear signal
        reasoning,
        score: 50,
        signals: ['llm:unknown'],
        stance,
      }
  }
}

// ============================================================================
// Test Utilities
// ============================================================================

export interface TestCase {
  name: string
  description: string
  input: ScoringInput
  expectedTier: 'high' | 'medium' | 'low' | 'unlikely' | 'unknown'
  expectedScoreRange?: [number, number]
}

export function runTestCase(
  testCase: TestCase,
  config: ScoringConfig = DEFAULT_CONFIG,
): {
  passed: boolean
  result: SecondChanceScore
  errors: string[]
} {
  const result = computeSecondChanceScore(testCase.input, config)
  const errors: string[] = []

  if (result.tier !== testCase.expectedTier) {
    errors.push(`Expected tier '${testCase.expectedTier}', got '${result.tier}'`)
  }

  if (testCase.expectedScoreRange) {
    const [min, max] = testCase.expectedScoreRange
    if (result.score < min || result.score > max) {
      errors.push(`Expected score ${min}-${max}, got ${result.score}`)
    }
  }

  return {
    errors,
    passed: errors.length === 0,
    result,
  }
}

export function runTestSuite(
  testCases: TestCase[],
  config: ScoringConfig = DEFAULT_CONFIG,
): {
  passed: number
  failed: number
  results: Array<{
    testCase: TestCase
    passed: boolean
    result: SecondChanceScore
    errors: string[]
  }>
} {
  const results = testCases.map(tc => ({
    testCase: tc,
    ...runTestCase(tc, config),
  }))

  return {
    failed: results.filter(r => !r.passed).length,
    passed: results.filter(r => r.passed).length,
    results,
  }
}
