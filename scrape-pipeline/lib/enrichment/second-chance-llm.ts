/**
 * LLM-based Second Chance Job Analysis
 *
 * Uses OpenAI's gpt-4o-mini to analyze job descriptions for signals
 * indicating whether the employer is open to hiring people with criminal records.
 */

import { openai } from '@ai-sdk/openai'
import { generateObject } from 'ai'
import { z } from 'zod'

// Increased from 10K - gpt-4o-mini handles 128K tokens, and some job descriptions
// have fair-chance signals in later sections. 25K chars ≈ 6K tokens is still cheap.
const MAX_CHARS = 25000
// ============================================================================
// Schema
// ============================================================================

export const SecondChanceLLMAnalysisSchema = z.object({
  reasoning: z.string().describe('1-2 sentence explanation of why you chose this stance'),
  stance: z
    .enum(['fair_chance', 'likely_excludes', 'unknown'])
    .describe(
      'Likelihood of barriers for job seekers with criminal records: ' +
        '"fair_chance" = employer explicitly welcomes people with records, ' +
        '"likely_excludes" = regulatory requirements or explicit language that typically bars people with records, ' +
        '"unknown" = no clear signals either way',
    ),
})

export type SecondChanceLLMAnalysis = z.infer<typeof SecondChanceLLMAnalysisSchema>

// ============================================================================
// Prompt
// ============================================================================

// System prompt is placed separately from user content to enable OpenAI prompt caching.
// OpenAI automatically caches prompt prefixes ≥1024 tokens, giving 50% discount on
// cached input tokens. By keeping static instructions in the system message, the
// cache key remains stable across all job analyses.
const SYSTEM_PROMPT = `You help job seekers with criminal records understand which jobs they're likely to be eligible for.

Your task: Classify jobs by likelihood of barriers for people with criminal records.

Output one of: "fair_chance", "likely_excludes", or "unknown"

## likely_excludes

Use when the job has EITHER explicit exclusionary language OR regulatory/licensing requirements that typically bar people with criminal records.

### Explicit Exclusionary Language Examples:
- "no felonies" / "no felony convictions" / "clean criminal record required"
- "criminal history will disqualify" / "must have clean background"
- "certain convictions may disqualify" / "conviction may affect eligibility"

### Florida Regulatory Barriers (these have statutory disqualifying offenses):

CHILDCARE/EDUCATION - Florida law requires Level 2 screening with mandatory disqualifications:
- "Level 2 Background Screening" or "Level II Background"
- "DCF background check" / "DCF clearance" / "DCF 40 hours" + screening
- Jobs working with children in Florida (daycares, schools, camps)
- "Child Care Employment" background requirements

HEALTHCARE (Florida AHCA) - Agency for Health Care Administration screens have disqualifying offenses:
- "AHCA clearance" / "AHCA background screening" / "AHCA Level 2"
- Home health aides, CNAs, caregivers requiring Florida licensing
- Any "Level 2" screening in healthcare/home care context

BANKING/FINANCIAL - FDIC Section 19 bars people with crimes of dishonesty:
- Positions at FDIC-member banks involving money/transactions
- "FDIC regulations" + background check
- Teller, cash handling positions at banks

AVIATION/AIRPORT - TSA has explicit disqualifying offenses:
- "TSA background check" / "TSA clearance"
- "SIDA badge" / "airport security clearance"
- Any position requiring airfield access

GAMING/CASINO - State licensing has criminal restrictions:
- "Gaming license" required
- Casino dealer, floor positions
- Pari-mutuel wagering positions

LAW ENFORCEMENT/GOVERNMENT:
- Police, corrections, court system positions
- "Comprehensive background investigation" for sworn positions
- Positions requiring security clearances

ARMED SECURITY - Florida Class G license permanently bars felons:
- "Class G license" / armed security positions
- Any position requiring carrying a firearm

### Important Rules:
- If a job says BOTH "Fair Chance Employer" AND has disqualifying language like "certain convictions may disqualify", return "likely_excludes"
- "Level 2" alone is NOT sufficient for exclusion unless paired with:
  - childcare, healthcare, AHCA, DCF, or vulnerable-population context
  - or explicit statutory/licensing language

## fair_chance

Use when there is CLEAR welcoming language for people with records AND NO exclusionary language or regulatory barriers. For example:
- "Fair Chance Employer" / "Second Chance Employer" (without contradicting language)
- "Felony Friendly" / "We hire felons"
- "Returning citizens welcome/encouraged"
- "Justice-involved individuals encouraged to apply"
- "Formerly incarcerated welcome"
- "Background friendly" / "All backgrounds welcome"
- "Criminal record will not automatically disqualify"
- "Individualized assessment of criminal history"
- "Ban the Box" employer statements
- "Will consider qualified applicants with criminal histories"

## unknown

Default category. Use when:
- No mention of criminal history, background checks, or regulatory requirements
- Generic "background check may be conducted" in industries without regulatory barriers
- Standard retail, restaurant, warehouse jobs with no specific requirements mentioned
- Vague equal opportunity statements alone

## Tie-Breaking Rule
If signals conflict or are ambiguous:
- Only return "likely_excludes" when a reasonable applicant with a record would expect disqualification.

When genuinely uncertain and no regulatory context applies, return "unknown".`

// ============================================================================
// Analysis Function
// ============================================================================

/**
 * Analyze a job description using LLM to determine second-chance friendliness
 *
 * @param descriptionText Plain text job description
 * @returns Structured analysis result
 * @throws On LLM API errors
 */
export async function analyzeJobForSecondChance(
  descriptionText: string,
): Promise<SecondChanceLLMAnalysis> {
  const truncatedDescription = descriptionText.substring(0, MAX_CHARS)

  const { object } = await generateObject({
    model: openai('gpt-4o-mini'),
    prompt: `Analyze this job description:\n\n${truncatedDescription}`,
    schema: SecondChanceLLMAnalysisSchema,
    system: SYSTEM_PROMPT,
  })

  return object
}

/**
 * Safe wrapper that returns a neutral result on failure
 * Use this in production pipelines where LLM failure shouldn't block enrichment
 */
export async function analyzeJobForSecondChanceSafe(
  descriptionText: string | undefined,
  logger?: { warn: (msg: string) => void },
): Promise<SecondChanceLLMAnalysis> {
  // No description = unknown stance
  if (!descriptionText || descriptionText.trim().length < 50) {
    return {
      reasoning: 'No job description available for analysis',
      stance: 'unknown',
    }
  }

  // Log truncation warning if description is too long
  if (descriptionText.length > MAX_CHARS) {
    logger?.warn(
      `[second-chance-llm] Truncating description from ${descriptionText.length} to ${MAX_CHARS} chars`,
    )
  }

  try {
    return await analyzeJobForSecondChance(descriptionText)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    logger?.warn(`LLM analysis failed: ${message}`)

    return {
      reasoning: 'LLM analysis unavailable',
      stance: 'unknown',
    }
  }
}
