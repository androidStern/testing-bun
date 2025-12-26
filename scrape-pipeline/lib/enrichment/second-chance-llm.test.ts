import { describe, expect, mock, test } from 'bun:test'
import { analyzeJobForSecondChanceSafe, SecondChanceLLMAnalysisSchema } from './second-chance-llm'

describe('SecondChanceLLMAnalysisSchema', () => {
  test('schema includes stance enum field', () => {
    const schemaShape = SecondChanceLLMAnalysisSchema.shape

    expect(schemaShape).toHaveProperty('stance')
    expect(schemaShape).toHaveProperty('reasoning')

    // Verify valid stances are accepted
    const validResult = SecondChanceLLMAnalysisSchema.safeParse({
      reasoning: 'Job says Fair Chance Employer',
      stance: 'fair_chance',
    })
    expect(validResult.success).toBe(true)
  })

  test('schema accepts all valid stance values', () => {
    const stances = ['fair_chance', 'likely_excludes', 'unknown'] as const

    for (const stance of stances) {
      const result = SecondChanceLLMAnalysisSchema.safeParse({
        reasoning: 'Test reasoning',
        stance,
      })
      expect(result.success).toBe(true)
    }
  })

  test('schema rejects invalid stance values', () => {
    const invalidResult = SecondChanceLLMAnalysisSchema.safeParse({
      reasoning: 'Test',
      stance: 'invalid_stance',
    })
    expect(invalidResult.success).toBe(false)
  })
})

describe('analyzeJobForSecondChanceSafe()', () => {
  test('logs warning when truncating description', async () => {
    const longDescription = 'x'.repeat(10000) // Over 8000 char limit
    const mockLogger = { warn: mock(() => {}) }

    // Even if LLM fails, it should log the truncation warning
    await analyzeJobForSecondChanceSafe(longDescription, mockLogger)

    // Verify truncation was logged
    expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining('Truncating'))
  })

  test('short description returns unknown stance without calling LLM', async () => {
    const shortDescription = 'Short job'
    const mockLogger = { warn: mock(() => {}) }

    const result = await analyzeJobForSecondChanceSafe(shortDescription, mockLogger)

    expect(result.stance).toBe('unknown')
    expect(result.reasoning).toContain('No job description')
  })

  test('empty description returns unknown stance', async () => {
    const result = await analyzeJobForSecondChanceSafe('', undefined)

    expect(result.stance).toBe('unknown')
    expect(result.reasoning).toContain('No job description')
  })

  test('undefined description returns unknown stance', async () => {
    const result = await analyzeJobForSecondChanceSafe(undefined, undefined)

    expect(result.stance).toBe('unknown')
  })
})
