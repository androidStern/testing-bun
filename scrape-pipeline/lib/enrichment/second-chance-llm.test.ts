import { describe, test, expect, mock } from 'bun:test';
import { SecondChanceLLMAnalysisSchema, analyzeJobForSecondChanceSafe } from './second-chance-llm';

describe('SecondChanceLLMAnalysisSchema', () => {
  test('schema includes stance enum field', () => {
    const schemaShape = SecondChanceLLMAnalysisSchema.shape;

    expect(schemaShape).toHaveProperty('stance');
    expect(schemaShape).toHaveProperty('reasoning');

    // Verify valid stances are accepted
    const validResult = SecondChanceLLMAnalysisSchema.safeParse({
      stance: 'explicitly_fair_chance',
      reasoning: 'Job says Fair Chance Employer',
    });
    expect(validResult.success).toBe(true);
  });

  test('schema accepts all valid stance values', () => {
    const stances = ['explicitly_fair_chance', 'explicitly_excludes', 'unknown'] as const;

    for (const stance of stances) {
      const result = SecondChanceLLMAnalysisSchema.safeParse({
        stance,
        reasoning: 'Test reasoning',
      });
      expect(result.success).toBe(true);
    }
  });

  test('schema rejects invalid stance values', () => {
    const invalidResult = SecondChanceLLMAnalysisSchema.safeParse({
      stance: 'invalid_stance',
      reasoning: 'Test',
    });
    expect(invalidResult.success).toBe(false);
  });
});

describe('analyzeJobForSecondChanceSafe()', () => {
  test('logs warning when truncating description', async () => {
    const longDescription = 'x'.repeat(10000); // Over 8000 char limit
    const mockLogger = { warn: mock(() => {}) };

    // Even if LLM fails, it should log the truncation warning
    await analyzeJobForSecondChanceSafe(longDescription, mockLogger);

    // Verify truncation was logged
    expect(mockLogger.warn).toHaveBeenCalledWith(
      expect.stringContaining('Truncating')
    );
  });

  test('short description returns unknown stance without calling LLM', async () => {
    const shortDescription = 'Short job';
    const mockLogger = { warn: mock(() => {}) };

    const result = await analyzeJobForSecondChanceSafe(shortDescription, mockLogger);

    expect(result.stance).toBe('unknown');
    expect(result.reasoning).toContain('No job description');
  });

  test('empty description returns unknown stance', async () => {
    const result = await analyzeJobForSecondChanceSafe('', undefined);

    expect(result.stance).toBe('unknown');
    expect(result.reasoning).toContain('No job description');
  });

  test('undefined description returns unknown stance', async () => {
    const result = await analyzeJobForSecondChanceSafe(undefined, undefined);

    expect(result.stance).toBe('unknown');
  });
});
