/**
 * Company name matching algorithms
 * Implements multiple algorithms for comparison
 */

import { doubleMetaphone } from 'double-metaphone';
import natural from 'natural';
import stringSimilarity from 'string-similarity';
import { normalize, normalizeForPhonetic, tokenize } from './normalize.js';

// ============================================================================
// Types
// ============================================================================

export interface KeyGenerator {
  name: string;
  description: string;
  generateKey: (name: string) => string;
}

export interface SimilarityScorer {
  name: string;
  description: string;
  compare: (a: string, b: string) => number; // Returns 0-1, higher = more similar
}

export interface MatchResult {
  algorithm: string;
  nameA: string;
  nameB: string;
  normalizedA: string;
  normalizedB: string;
  keyA?: string;
  keyB?: string;
  score?: number;
  isMatch: boolean;
}

// ============================================================================
// Key Generators (deterministic - same input always produces same key)
// ============================================================================

/**
 * Double Metaphone - phonetic algorithm
 * Returns a phonetic code representing how the name sounds
 */
export const doubleMetaphoneGenerator: KeyGenerator = {
  name: 'double-metaphone',
  description: 'Phonetic key based on pronunciation',
  generateKey: (name: string): string => {
    const normalized = normalizeForPhonetic(name);
    if (!normalized) return '';

    // Generate keys for each word and combine
    const words = normalized.split(/\s+/);
    const keys = words.map(word => {
      const [primary, secondary] = doubleMetaphone(word);
      return primary || '';
    });

    return keys.join('|');
  }
};

/**
 * Soundex - classic phonetic algorithm
 * Simpler than metaphone, good for surnames
 */
const soundex = new natural.SoundEx();

export const soundexGenerator: KeyGenerator = {
  name: 'soundex',
  description: 'Classic phonetic algorithm',
  generateKey: (name: string): string => {
    const normalized = normalizeForPhonetic(name);
    if (!normalized) return '';

    const words = normalized.split(/\s+/);
    const keys = words.map(word => soundex.process(word));
    return keys.join('|');
  }
};

/**
 * Normalized key - just normalization, no phonetic encoding
 * Baseline to see how much preprocessing alone helps
 */
export const normalizedKeyGenerator: KeyGenerator = {
  name: 'normalized',
  description: 'Normalized string with suffixes removed',
  generateKey: (name: string): string => {
    return normalize(name).replace(/\s+/g, '');
  }
};

// ============================================================================
// Similarity Scorers (pairwise - compare two names)
// ============================================================================

/**
 * Jaro-Winkler distance
 * Good for names with similar prefixes
 */
export const jaroWinklerScorer: SimilarityScorer = {
  name: 'jaro-winkler',
  description: 'Edit distance weighted toward prefix matches',
  compare: (a: string, b: string): number => {
    const normA = normalize(a);
    const normB = normalize(b);
    if (!normA || !normB) return 0;

    return natural.JaroWinklerDistance(normA, normB);
  }
};

/**
 * Levenshtein distance (normalized to 0-1)
 * Good for detecting typos
 */
export const levenshteinScorer: SimilarityScorer = {
  name: 'levenshtein',
  description: 'Edit distance normalized to 0-1',
  compare: (a: string, b: string): number => {
    const normA = normalize(a);
    const normB = normalize(b);
    if (!normA || !normB) return 0;

    const distance = natural.LevenshteinDistance(normA, normB);
    const maxLen = Math.max(normA.length, normB.length);
    return maxLen > 0 ? 1 - distance / maxLen : 1;
  }
};

/**
 * Dice coefficient (Sørensen–Dice)
 * Token-based similarity, good for multi-word names
 */
export const diceScorer: SimilarityScorer = {
  name: 'dice-coefficient',
  description: 'Token-based similarity (Sørensen-Dice)',
  compare: (a: string, b: string): number => {
    const normA = normalize(a);
    const normB = normalize(b);
    if (!normA || !normB) return 0;

    return stringSimilarity.compareTwoStrings(normA, normB);
  }
};

/**
 * Jaccard similarity
 * Set-based similarity using tokens
 */
export const jaccardScorer: SimilarityScorer = {
  name: 'jaccard',
  description: 'Set-based token similarity',
  compare: (a: string, b: string): number => {
    const tokensA = new Set(tokenize(a));
    const tokensB = new Set(tokenize(b));

    if (tokensA.size === 0 || tokensB.size === 0) return 0;

    const intersection = new Set([...tokensA].filter(x => tokensB.has(x)));
    const union = new Set([...tokensA, ...tokensB]);

    return intersection.size / union.size;
  }
};

// ============================================================================
// Hybrid Approaches
// ============================================================================

/**
 * Combined scorer - uses multiple signals
 * Averages multiple similarity scores
 */
export const combinedScorer: SimilarityScorer = {
  name: 'combined',
  description: 'Average of Jaro-Winkler, Levenshtein, and Dice',
  compare: (a: string, b: string): number => {
    const jw = jaroWinklerScorer.compare(a, b);
    const lev = levenshteinScorer.compare(a, b);
    const dice = diceScorer.compare(a, b);

    return (jw + lev + dice) / 3;
  }
};

/**
 * Metaphone + Jaro-Winkler hybrid
 * Uses metaphone key match OR high Jaro-Winkler score
 */
export function hybridMatch(a: string, b: string, jaroThreshold = 0.85): boolean {
  // First check metaphone keys
  const keyA = doubleMetaphoneGenerator.generateKey(a);
  const keyB = doubleMetaphoneGenerator.generateKey(b);

  if (keyA && keyB && keyA === keyB) {
    return true;
  }

  // Fallback to Jaro-Winkler similarity
  const jaroScore = jaroWinklerScorer.compare(a, b);
  return jaroScore >= jaroThreshold;
}

// ============================================================================
// Exports
// ============================================================================

export const keyGenerators: KeyGenerator[] = [
  doubleMetaphoneGenerator,
  soundexGenerator,
  normalizedKeyGenerator
];

export const similarityScorers: SimilarityScorer[] = [
  jaroWinklerScorer,
  levenshteinScorer,
  diceScorer,
  jaccardScorer,
  combinedScorer
];

/**
 * Match two company names using a key generator
 */
export function matchByKey(a: string, b: string, generator: KeyGenerator): MatchResult {
  const keyA = generator.generateKey(a);
  const keyB = generator.generateKey(b);

  return {
    algorithm: generator.name,
    nameA: a,
    nameB: b,
    normalizedA: normalize(a),
    normalizedB: normalize(b),
    keyA,
    keyB,
    isMatch: keyA !== '' && keyB !== '' && keyA === keyB
  };
}

/**
 * Match two company names using a similarity scorer
 */
export function matchByScore(
  a: string,
  b: string,
  scorer: SimilarityScorer,
  threshold: number
): MatchResult {
  const score = scorer.compare(a, b);

  return {
    algorithm: scorer.name,
    nameA: a,
    nameB: b,
    normalizedA: normalize(a),
    normalizedB: normalize(b),
    score,
    isMatch: score >= threshold
  };
}
