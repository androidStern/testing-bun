/**
 * Evaluation script for company name matching algorithms
 * Runs all algorithms against test dataset and calculates metrics
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import {
  keyGenerators,
  similarityScorers,
  matchByKey,
  matchByScore,
  hybridMatch,
  type KeyGenerator,
  type SimilarityScorer
} from './algorithms.js';
import { normalize } from './normalize.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ============================================================================
// Types
// ============================================================================

interface TestData {
  description: string;
  true_matches: [string, string][];
  true_non_matches: [string, string][];
}

interface EvaluationResult {
  algorithm: string;
  threshold?: number;
  truePositives: number;
  falsePositives: number;
  trueNegatives: number;
  falseNegatives: number;
  precision: number;
  recall: number;
  f1Score: number;
  accuracy: number;
}

interface DetailedResult {
  pair: [string, string];
  expected: boolean;
  predicted: boolean;
  correct: boolean;
  score?: number;
  keyA?: string;
  keyB?: string;
}

// ============================================================================
// Load Test Data
// ============================================================================

function loadTestData(): TestData {
  const dataPath = join(__dirname, 'datasets', 'test-pairs.json');
  const content = readFileSync(dataPath, 'utf-8');
  return JSON.parse(content);
}

// ============================================================================
// Evaluation Functions
// ============================================================================

function calculateMetrics(
  tp: number,
  fp: number,
  tn: number,
  fn: number
): { precision: number; recall: number; f1Score: number; accuracy: number } {
  const precision = tp + fp > 0 ? tp / (tp + fp) : 0;
  const recall = tp + fn > 0 ? tp / (tp + fn) : 0;
  const f1Score = precision + recall > 0 ? 2 * (precision * recall) / (precision + recall) : 0;
  const accuracy = tp + fp + tn + fn > 0 ? (tp + tn) / (tp + fp + tn + fn) : 0;

  return { precision, recall, f1Score, accuracy };
}

function evaluateKeyGenerator(
  generator: KeyGenerator,
  trueMatches: [string, string][],
  trueNonMatches: [string, string][]
): { result: EvaluationResult; details: DetailedResult[] } {
  let tp = 0, fp = 0, tn = 0, fn = 0;
  const details: DetailedResult[] = [];

  // Test true matches (expected: match)
  for (const [a, b] of trueMatches) {
    const matchResult = matchByKey(a, b, generator);
    const predicted = matchResult.isMatch;
    const correct = predicted === true;

    if (predicted) tp++;
    else fn++;

    details.push({
      pair: [a, b],
      expected: true,
      predicted,
      correct,
      keyA: matchResult.keyA,
      keyB: matchResult.keyB
    });
  }

  // Test true non-matches (expected: no match)
  for (const [a, b] of trueNonMatches) {
    const matchResult = matchByKey(a, b, generator);
    const predicted = matchResult.isMatch;
    const correct = predicted === false;

    if (predicted) fp++;
    else tn++;

    details.push({
      pair: [a, b],
      expected: false,
      predicted,
      correct,
      keyA: matchResult.keyA,
      keyB: matchResult.keyB
    });
  }

  const metrics = calculateMetrics(tp, fp, tn, fn);

  return {
    result: {
      algorithm: generator.name,
      truePositives: tp,
      falsePositives: fp,
      trueNegatives: tn,
      falseNegatives: fn,
      ...metrics
    },
    details
  };
}

function evaluateSimilarityScorer(
  scorer: SimilarityScorer,
  trueMatches: [string, string][],
  trueNonMatches: [string, string][],
  threshold: number
): { result: EvaluationResult; details: DetailedResult[] } {
  let tp = 0, fp = 0, tn = 0, fn = 0;
  const details: DetailedResult[] = [];

  // Test true matches (expected: match)
  for (const [a, b] of trueMatches) {
    const matchResult = matchByScore(a, b, scorer, threshold);
    const predicted = matchResult.isMatch;
    const correct = predicted === true;

    if (predicted) tp++;
    else fn++;

    details.push({
      pair: [a, b],
      expected: true,
      predicted,
      correct,
      score: matchResult.score
    });
  }

  // Test true non-matches (expected: no match)
  for (const [a, b] of trueNonMatches) {
    const matchResult = matchByScore(a, b, scorer, threshold);
    const predicted = matchResult.isMatch;
    const correct = predicted === false;

    if (predicted) fp++;
    else tn++;

    details.push({
      pair: [a, b],
      expected: false,
      predicted,
      correct,
      score: matchResult.score
    });
  }

  const metrics = calculateMetrics(tp, fp, tn, fn);

  return {
    result: {
      algorithm: scorer.name,
      threshold,
      truePositives: tp,
      falsePositives: fp,
      trueNegatives: tn,
      falseNegatives: fn,
      ...metrics
    },
    details
  };
}

function evaluateHybrid(
  trueMatches: [string, string][],
  trueNonMatches: [string, string][],
  jaroThreshold: number
): { result: EvaluationResult; details: DetailedResult[] } {
  let tp = 0, fp = 0, tn = 0, fn = 0;
  const details: DetailedResult[] = [];

  for (const [a, b] of trueMatches) {
    const predicted = hybridMatch(a, b, jaroThreshold);
    const correct = predicted === true;

    if (predicted) tp++;
    else fn++;

    details.push({ pair: [a, b], expected: true, predicted, correct });
  }

  for (const [a, b] of trueNonMatches) {
    const predicted = hybridMatch(a, b, jaroThreshold);
    const correct = predicted === false;

    if (predicted) fp++;
    else tn++;

    details.push({ pair: [a, b], expected: false, predicted, correct });
  }

  const metrics = calculateMetrics(tp, fp, tn, fn);

  return {
    result: {
      algorithm: `hybrid (metaphone + jaro@${jaroThreshold})`,
      threshold: jaroThreshold,
      truePositives: tp,
      falsePositives: fp,
      trueNegatives: tn,
      falseNegatives: fn,
      ...metrics
    },
    details
  };
}

// ============================================================================
// Reporting
// ============================================================================

function formatPercent(n: number): string {
  return (n * 100).toFixed(1) + '%';
}

function printResults(results: EvaluationResult[], title: string) {
  console.log('\n' + '='.repeat(80));
  console.log(title);
  console.log('='.repeat(80));

  // Sort by F1 score descending
  const sorted = [...results].sort((a, b) => b.f1Score - a.f1Score);

  console.log('\n%-35s %10s %10s %10s %10s'.replace(/%(\d+)s/g, (_, w) => `%-${w}s`),
    'Algorithm', 'Precision', 'Recall', 'F1', 'Accuracy');
  console.log('-'.repeat(80));

  for (const r of sorted) {
    const name = r.threshold !== undefined
      ? `${r.algorithm} @${r.threshold}`
      : r.algorithm;

    console.log(
      `%-35s %10s %10s %10s %10s`,
      name.substring(0, 35),
      formatPercent(r.precision),
      formatPercent(r.recall),
      formatPercent(r.f1Score),
      formatPercent(r.accuracy)
    );
  }

  console.log('-'.repeat(80));
}

function printErrorAnalysis(details: DetailedResult[], algorithm: string, limit = 10) {
  const errors = details.filter(d => !d.correct);

  if (errors.length === 0) {
    console.log(`\n${algorithm}: No errors!`);
    return;
  }

  console.log(`\n${algorithm}: ${errors.length} errors (showing first ${Math.min(limit, errors.length)}):`);

  const falseNegatives = errors.filter(e => e.expected && !e.predicted).slice(0, limit / 2);
  const falsePositives = errors.filter(e => !e.expected && e.predicted).slice(0, limit / 2);

  if (falseNegatives.length > 0) {
    console.log('\n  FALSE NEGATIVES (should match but didn\'t):');
    for (const e of falseNegatives) {
      const extra = e.score !== undefined
        ? `score=${e.score.toFixed(3)}`
        : `keys: "${e.keyA}" vs "${e.keyB}"`;
      console.log(`    "${e.pair[0]}" ↔ "${e.pair[1]}" (${extra})`);
    }
  }

  if (falsePositives.length > 0) {
    console.log('\n  FALSE POSITIVES (shouldn\'t match but did):');
    for (const e of falsePositives) {
      const extra = e.score !== undefined
        ? `score=${e.score.toFixed(3)}`
        : `keys: "${e.keyA}" vs "${e.keyB}"`;
      console.log(`    "${e.pair[0]}" ↔ "${e.pair[1]}" (${extra})`);
    }
  }
}

// ============================================================================
// Main
// ============================================================================

async function main() {
  console.log('Company Name Matching Algorithm Evaluation');
  console.log('==========================================\n');

  // Load test data
  const testData = loadTestData();
  console.log(`Loaded ${testData.true_matches.length} true match pairs`);
  console.log(`Loaded ${testData.true_non_matches.length} true non-match pairs`);
  console.log(`Total test pairs: ${testData.true_matches.length + testData.true_non_matches.length}`);

  const allResults: EvaluationResult[] = [];
  const detailsMap = new Map<string, DetailedResult[]>();

  // Evaluate key generators
  console.log('\nEvaluating key generators...');
  for (const generator of keyGenerators) {
    const { result, details } = evaluateKeyGenerator(
      generator,
      testData.true_matches,
      testData.true_non_matches
    );
    allResults.push(result);
    detailsMap.set(result.algorithm, details);
  }

  // Evaluate similarity scorers at multiple thresholds
  console.log('Evaluating similarity scorers...');
  const thresholds = [0.7, 0.75, 0.8, 0.85, 0.9, 0.95];

  for (const scorer of similarityScorers) {
    for (const threshold of thresholds) {
      const { result, details } = evaluateSimilarityScorer(
        scorer,
        testData.true_matches,
        testData.true_non_matches,
        threshold
      );
      allResults.push(result);
      detailsMap.set(`${result.algorithm}@${threshold}`, details);
    }
  }

  // Evaluate hybrid approach
  console.log('Evaluating hybrid approaches...');
  for (const threshold of [0.8, 0.85, 0.9]) {
    const { result, details } = evaluateHybrid(
      testData.true_matches,
      testData.true_non_matches,
      threshold
    );
    allResults.push(result);
    detailsMap.set(result.algorithm, details);
  }

  // Print results
  printResults(allResults, 'All Results');

  // Print best results by category
  const keyResults = allResults.filter(r => !r.threshold || r.algorithm.includes('hybrid'));
  const scorerResults = allResults.filter(r => r.threshold && !r.algorithm.includes('hybrid'));

  printResults(keyResults, 'Key-Based Algorithms (Deterministic)');
  printResults(scorerResults, 'Similarity-Based Algorithms (with thresholds)');

  // Find best overall
  const best = allResults.reduce((a, b) => a.f1Score > b.f1Score ? a : b);
  console.log('\n' + '='.repeat(80));
  console.log('BEST ALGORITHM:', best.algorithm, best.threshold ? `@${best.threshold}` : '');
  console.log(`F1: ${formatPercent(best.f1Score)} | Precision: ${formatPercent(best.precision)} | Recall: ${formatPercent(best.recall)}`);
  console.log('='.repeat(80));

  // Error analysis for top algorithms
  console.log('\n' + '='.repeat(80));
  console.log('ERROR ANALYSIS');
  console.log('='.repeat(80));

  // Error analysis for key generators
  for (const gen of keyGenerators) {
    const details = detailsMap.get(gen.name);
    if (details) {
      printErrorAnalysis(details, gen.name);
    }
  }

  // Error analysis for best similarity scorer
  const bestScorer = scorerResults.reduce((a, b) => a.f1Score > b.f1Score ? a : b);
  const bestScorerKey = `${bestScorer.algorithm}@${bestScorer.threshold}`;
  const bestScorerDetails = detailsMap.get(bestScorerKey);
  if (bestScorerDetails) {
    printErrorAnalysis(bestScorerDetails, bestScorerKey, 20);
  }

  // Summary recommendations
  console.log('\n' + '='.repeat(80));
  console.log('RECOMMENDATIONS');
  console.log('='.repeat(80));

  const metaphoneResult = allResults.find(r => r.algorithm === 'double-metaphone');
  const normalizedResult = allResults.find(r => r.algorithm === 'normalized');

  console.log('\n1. DOUBLE-METAPHONE (key-based):');
  if (metaphoneResult) {
    console.log(`   Precision: ${formatPercent(metaphoneResult.precision)} | Recall: ${formatPercent(metaphoneResult.recall)}`);
    console.log(`   Verdict: ${metaphoneResult.precision >= 0.9 && metaphoneResult.recall >= 0.8 ? '✓ MEETS TARGETS' : '✗ Does not meet targets'}`);
  }

  console.log('\n2. NORMALIZED (preprocessing only):');
  if (normalizedResult) {
    console.log(`   Precision: ${formatPercent(normalizedResult.precision)} | Recall: ${formatPercent(normalizedResult.recall)}`);
    console.log(`   Verdict: ${normalizedResult.precision >= 0.9 && normalizedResult.recall >= 0.8 ? '✓ MEETS TARGETS' : '✗ Does not meet targets'}`);
  }

  console.log('\n3. BEST OVERALL:', best.algorithm);
  console.log(`   Precision: ${formatPercent(best.precision)} | Recall: ${formatPercent(best.recall)}`);
  console.log(`   Verdict: ${best.precision >= 0.9 && best.recall >= 0.8 ? '✓ MEETS TARGETS' : '✗ Does not meet targets'}`);

  // Check if any meet targets
  const meetingTargets = allResults.filter(r => r.precision >= 0.9 && r.recall >= 0.8);
  console.log(`\n${meetingTargets.length} algorithm(s) meet the target criteria (≥90% precision, ≥80% recall):`);
  for (const r of meetingTargets.sort((a, b) => b.f1Score - a.f1Score)) {
    const name = r.threshold ? `${r.algorithm} @${r.threshold}` : r.algorithm;
    console.log(`   - ${name}: P=${formatPercent(r.precision)} R=${formatPercent(r.recall)} F1=${formatPercent(r.f1Score)}`);
  }
}

main().catch(console.error);
