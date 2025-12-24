/**
 * Evaluation script for MinHash LSH blocking
 * Tests blocking key approach at various parameter settings
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import {
  areBlockingCandidates,
  generateBlockingKeys,
  shingle,
  shingleWords,
  shingleWordsNormalized,
  shingleChars,
  shingleHybrid,
  computeSignature,
  estimateSimilarity,
  type MinHashConfig,
  DEFAULT_CONFIG
} from './minhash.js';
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
  config: MinHashConfig;
  truePositives: number;
  falsePositives: number;
  trueNegatives: number;
  falseNegatives: number;
  precision: number;
  recall: number;
  f1Score: number;
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
// Evaluation
// ============================================================================

function evaluate(
  trueMatches: [string, string][],
  trueNonMatches: [string, string][],
  config: MinHashConfig
): EvaluationResult {
  let tp = 0, fp = 0, tn = 0, fn = 0;

  // Test true matches
  for (const [a, b] of trueMatches) {
    const isCandidate = areBlockingCandidates(a, b, config);
    if (isCandidate) tp++;
    else fn++;
  }

  // Test true non-matches
  for (const [a, b] of trueNonMatches) {
    const isCandidate = areBlockingCandidates(a, b, config);
    if (isCandidate) fp++;
    else tn++;
  }

  const precision = tp + fp > 0 ? tp / (tp + fp) : 0;
  const recall = tp + fn > 0 ? tp / (tp + fn) : 0;
  const f1Score = precision + recall > 0 ? 2 * (precision * recall) / (precision + recall) : 0;

  return {
    config,
    truePositives: tp,
    falsePositives: fp,
    trueNegatives: tn,
    falseNegatives: fn,
    precision,
    recall,
    f1Score
  };
}

// ============================================================================
// Parameter Grid Search
// ============================================================================

function gridSearch(
  trueMatches: [string, string][],
  trueNonMatches: [string, string][]
): EvaluationResult[] {
  const results: EvaluationResult[] = [];

  // Test different configurations
  const numHashesOptions = [64, 128, 256];
  const bandsOptions = [4, 8, 16, 32];
  const shingleSizeOptions = [2, 3, 4];

  for (const numHashes of numHashesOptions) {
    for (const bands of bandsOptions) {
      // bands must divide numHashes evenly
      if (numHashes % bands !== 0) continue;

      for (const shingleSize of shingleSizeOptions) {
        const config: MinHashConfig = { numHashes, bands, shingleSize };
        const result = evaluate(trueMatches, trueNonMatches, config);
        results.push(result);
      }
    }
  }

  return results;
}

// ============================================================================
// Error Analysis
// ============================================================================

function analyzeErrors(
  pairs: [string, string][],
  expected: boolean,
  config: MinHashConfig,
  limit: number = 10
): void {
  const errors: { pair: [string, string]; sharedKeys: number; estSim: number }[] = [];

  for (const [a, b] of pairs) {
    const isCandidate = areBlockingCandidates(a, b, config);
    if (isCandidate !== expected) {
      // Count shared keys
      const keysA = new Set(generateBlockingKeys(a, config));
      const keysB = generateBlockingKeys(b, config);
      let sharedKeys = 0;
      for (const k of keysB) {
        if (keysA.has(k)) sharedKeys++;
      }

      // Estimate similarity
      const shinglesA = shingle(a, config.shingleSize);
      const shinglesB = shingle(b, config.shingleSize);
      const sigA = computeSignature(shinglesA, config.numHashes);
      const sigB = computeSignature(shinglesB, config.numHashes);
      const estSim = estimateSimilarity(sigA, sigB);

      errors.push({ pair: [a, b], sharedKeys, estSim });
    }
  }

  if (errors.length === 0) {
    console.log(`  No errors!`);
    return;
  }

  console.log(`  ${errors.length} errors (showing first ${Math.min(limit, errors.length)}):`);
  for (const e of errors.slice(0, limit)) {
    const label = expected ? 'FN' : 'FP';
    console.log(`    [${label}] "${e.pair[0]}" ↔ "${e.pair[1]}"`);
    console.log(`         shared_keys=${e.sharedKeys}, est_similarity=${e.estSim.toFixed(3)}`);
    console.log(`         normalized: "${normalize(e.pair[0])}" ↔ "${normalize(e.pair[1])}"`);
  }
}

// ============================================================================
// Main
// ============================================================================

async function main() {
  console.log('MinHash LSH Blocking Evaluation');
  console.log('================================\n');

  const testData = loadTestData();
  console.log(`Loaded ${testData.true_matches.length} true match pairs`);
  console.log(`Loaded ${testData.true_non_matches.length} true non-match pairs\n`);

  // Quick test: show shingles for problem pairs
  console.log('=== SHINGLE COMPARISON ===\n');
  const problemPairs: [string, string, boolean][] = [
    ['Microsoft', 'Micron', false],
    ['Apple', 'Snapple', false],
    ['Tesla Motors', 'Tesla Inc', true],
    ['McDonald\'s', 'McDonalds Corp', true],
    ['Home Depot', 'HomeDepot', true],
    ['WAL-MART', 'Walmart', true],
    ['PepsiCo', 'Pepsi', true],
  ];

  for (const [a, b, shouldMatch] of problemPairs) {
    console.log(`"${a}" vs "${b}" (should ${shouldMatch ? 'MATCH' : 'NOT match'})`);
    const normA = shingleWordsNormalized(a);
    const normB = shingleWordsNormalized(b);

    const overlap = [...normA].filter(x => normB.has(x));

    console.log(`  Shingles A: ${[...normA].join(', ')}`);
    console.log(`  Shingles B: ${[...normB].join(', ')}`);
    console.log(`  Overlap: ${overlap.length > 0 ? overlap.join(', ') : 'NONE'}`);
    console.log();
  }

  // Test with WORD-LEVEL shingles (default now)
  console.log('=== WORD-LEVEL SHINGLES ===\n');

  const wordConfig: MinHashConfig = { numHashes: 64, bands: 32, shingleSize: 0 }; // shingleSize ignored for words
  const wordResult = evaluate(testData.true_matches, testData.true_non_matches, wordConfig);
  console.log(`Config: 64 hashes, 32 bands, 2 rows/band, WORD shingles`);
  console.log(`Precision: ${(wordResult.precision * 100).toFixed(1)}%`);
  console.log(`Recall: ${(wordResult.recall * 100).toFixed(1)}%`);
  console.log(`F1: ${(wordResult.f1Score * 100).toFixed(1)}%`);
  console.log(`TP=${wordResult.truePositives} FP=${wordResult.falsePositives} FN=${wordResult.falseNegatives}`);

  // Error analysis
  console.log('\nFalse Negatives (should match but didn\'t):');
  analyzeErrors(testData.true_matches, true, wordConfig, 15);
  console.log('\nFalse Positives (shouldn\'t match but did):');
  analyzeErrors(testData.true_non_matches, false, wordConfig, 15);

  // Try different band configurations with word shingles
  console.log('\n=== WORD SHINGLES - PARAMETER SWEEP ===\n');

  const wordResults: EvaluationResult[] = [];
  for (const numHashes of [32, 64, 128]) {
    for (const bands of [4, 8, 16, 32]) {
      if (numHashes % bands !== 0) continue;
      const config: MinHashConfig = { numHashes, bands, shingleSize: 0 };
      const result = evaluate(testData.true_matches, testData.true_non_matches, config);
      wordResults.push(result);
    }
  }

  wordResults.sort((a, b) => b.f1Score - a.f1Score);

  console.log('%-12s %-10s %-10s %-10s %-10s %-15s',
    'Config', 'Precision', 'Recall', 'F1', 'Accuracy', 'TP/FP/FN');
  console.log('-'.repeat(75));

  for (const r of wordResults.slice(0, 10)) {
    const rows = r.config.numHashes / r.config.bands;
    console.log(
      `%-12s %-10s %-10s %-10s %-10s %-15s`,
      `${r.config.numHashes}h/${r.config.bands}b`,
      `${(r.precision * 100).toFixed(1)}%`,
      `${(r.recall * 100).toFixed(1)}%`,
      `${(r.f1Score * 100).toFixed(1)}%`,
      `${((r.truePositives + r.trueNegatives) / 252 * 100).toFixed(1)}%`,
      `${r.truePositives}/${r.falsePositives}/${r.falseNegatives}`
    );
  }

  // Find best meeting targets
  const meetingTargets = wordResults.filter(r => r.precision >= 0.90 && r.recall >= 0.70);
  console.log(`\n${meetingTargets.length} configs meet targets (≥90% precision, ≥70% recall)`);

  if (meetingTargets.length > 0) {
    const best = meetingTargets.sort((a, b) => b.f1Score - a.f1Score)[0];
    console.log('\n*** BEST WORD-LEVEL CONFIG ***');
    console.log(`numHashes: ${best.config.numHashes}, bands: ${best.config.bands}`);
    console.log(`Precision: ${(best.precision * 100).toFixed(1)}%, Recall: ${(best.recall * 100).toFixed(1)}%, F1: ${(best.f1Score * 100).toFixed(1)}%`);
  }
}

main().catch(console.error);
