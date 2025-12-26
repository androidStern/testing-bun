/**
 * Integration tests for second-chance LLM classification
 *
 * These tests make REAL LLM calls to verify classification accuracy.
 * Test cases are defined in second-chance-realistic-cases.ts
 *
 * Run with: bun test scrape-pipeline/lib/enrichment/second-chance-llm.integration.test.ts
 */

import { describe, expect, test } from 'bun:test'
import { analyzeJobForSecondChance } from './second-chance-llm'
import { ALL_TEST_CASES, type TestCase } from './south-florida-test-cases'

describe('LLM Classification - all test cases', () => {
  const failures: { tc: TestCase; result: Record<string, string> }[] = []
  for (const tc of ALL_TEST_CASES) {
    test(
      tc.id,
      async () => {
        const result = await analyzeJobForSecondChance(tc.description)

        if (result.stance !== tc.expectedClassification) {
          failures.push({ result, tc })
        }
        expect(result.stance).toBe(tc.expectedClassification)
      },
      { timeout: 60000 },
    )
  }

  for (const failure of failures) {
    console.log(`Failed test case: ${failure.tc.id}`)
    console.log(`Reasoning: ${failure.result.reasoning}`)
    console.log(`Description: ${failure.tc.description}`)
  }
})
