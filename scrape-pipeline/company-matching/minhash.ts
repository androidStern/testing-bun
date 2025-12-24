/**
 * MinHash LSH implementation for company name blocking
 *
 * Generates blocking keys that group similar company names together.
 * Names sharing ANY blocking key are candidate matches.
 */

import { normalize } from './normalize.js';

// ============================================================================
// Configuration
// ============================================================================

export interface MinHashConfig {
  numHashes: number;    // Number of hash functions (signature size)
  bands: number;        // Number of bands for LSH
  shingleSize: number;  // Character n-gram size
}

export const DEFAULT_CONFIG: MinHashConfig = {
  numHashes: 128,
  bands: 16,           // 16 bands × 8 rows = 128 hashes
  shingleSize: 3,      // 3-character shingles
};

// ============================================================================
// Hashing utilities
// ============================================================================

// Simple seeded hash function (MurmurHash3-like)
function hashWithSeed(str: string, seed: number): number {
  let h = seed ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x5bd1e995);
    h ^= h >>> 15;
  }
  return h >>> 0; // Convert to unsigned 32-bit
}

// Hash an array of numbers to a single key
function hashArray(arr: number[]): string {
  let h = 0;
  for (const val of arr) {
    h ^= val;
    h = Math.imul(h, 0x9e3779b9);
    h ^= h >>> 16;
  }
  return (h >>> 0).toString(36);
}

// ============================================================================
// Shingling
// ============================================================================

/**
 * Convert text to character n-grams (shingles)
 * Includes spaces to capture word boundaries
 */
export function shingleChars(text: string, n: number = 3): Set<string> {
  const normalized = normalize(text);
  const shingles = new Set<string>();

  // Pad with spaces to capture start/end
  const padded = ` ${normalized} `;

  for (let i = 0; i <= padded.length - n; i++) {
    shingles.add(padded.substring(i, i + n));
  }

  return shingles;
}

/**
 * Convert text to word-level shingles
 * Each word becomes a shingle - much more semantically meaningful
 */
export function shingleWords(text: string): Set<string> {
  const normalized = normalize(text);
  const words = normalized.split(/\s+/).filter(w => w.length > 0);
  return new Set(words);
}

/**
 * Normalize and remove ALL spaces for consistent comparison
 * "Home Depot" and "HomeDepot" both become "homedepot"
 */
function normalizeNoSpaces(text: string): string {
  return normalize(text).replace(/\s+/g, '');
}

/**
 * Word-level shingles with space-normalized variant
 * Handles both "Home Depot" and "HomeDepot" by including the joined form
 */
export function shingleWordsNormalized(text: string): Set<string> {
  const normalized = normalize(text);
  const shingles = new Set<string>();

  // Add individual words
  const words = normalized.split(/\s+/).filter(w => w.length > 0);
  for (const word of words) {
    shingles.add(word);
  }

  // Also add the fully joined version (handles "homedepot" vs "home depot")
  const joined = normalizeNoSpaces(text);
  if (joined.length > 0) {
    shingles.add(joined);
  }

  return shingles;
}

/**
 * Combined shingles: words + character n-grams of each word
 * This handles both word variations and typos
 */
export function shingleHybrid(text: string, charN: number = 3): Set<string> {
  const normalized = normalize(text);
  const shingles = new Set<string>();

  const words = normalized.split(/\s+/).filter(w => w.length > 0);

  for (const word of words) {
    // Add the full word
    shingles.add(`w:${word}`);

    // Add character n-grams of this word (for typo tolerance)
    if (word.length >= charN) {
      for (let i = 0; i <= word.length - charN; i++) {
        shingles.add(`c:${word.substring(i, i + charN)}`);
      }
    }
  }

  return shingles;
}

// Default shingle function - use word-level with space normalization
export function shingle(text: string, n: number = 3): Set<string> {
  return shingleWordsNormalized(text);
}

// ============================================================================
// MinHash Signature
// ============================================================================

/**
 * Compute MinHash signature for a set of shingles
 * Each position in the signature is the minimum hash value across all shingles
 * for a particular hash function (determined by seed)
 */
export function computeSignature(shingles: Set<string>, numHashes: number): number[] {
  const signature: number[] = new Array(numHashes).fill(Infinity);

  for (const s of shingles) {
    for (let i = 0; i < numHashes; i++) {
      const h = hashWithSeed(s, i);
      if (h < signature[i]) {
        signature[i] = h;
      }
    }
  }

  // Replace Infinity with 0 for empty shingle sets
  return signature.map(v => v === Infinity ? 0 : v);
}

// ============================================================================
// LSH Blocking Keys
// ============================================================================

/**
 * Generate blocking keys from a MinHash signature using LSH banding
 *
 * @param signature MinHash signature
 * @param bands Number of bands
 * @returns Array of blocking keys (one per band)
 */
export function signatureToBlockingKeys(signature: number[], bands: number): string[] {
  const rows = Math.floor(signature.length / bands);
  const keys: string[] = [];

  for (let b = 0; b < bands; b++) {
    const start = b * rows;
    const end = start + rows;
    const band = signature.slice(start, end);
    const bandHash = hashArray(band);
    keys.push(`b${b}_${bandHash}`);
  }

  return keys;
}

/**
 * Generate blocking keys for a company name
 *
 * @param name Company name
 * @param config MinHash configuration
 * @returns Array of blocking keys
 */
export function generateBlockingKeys(
  name: string,
  config: MinHashConfig = DEFAULT_CONFIG
): string[] {
  if (!name || name.trim().length === 0) {
    return [];
  }

  const shingles = shingle(name, config.shingleSize);
  if (shingles.size === 0) {
    return [];
  }

  const signature = computeSignature(shingles, config.numHashes);
  return signatureToBlockingKeys(signature, config.bands);
}

// ============================================================================
// Similarity estimation
// ============================================================================

/**
 * Estimate Jaccard similarity from MinHash signatures
 *
 * @param sig1 First signature
 * @param sig2 Second signature
 * @returns Estimated Jaccard similarity (0-1)
 */
export function estimateSimilarity(sig1: number[], sig2: number[]): number {
  if (sig1.length !== sig2.length) {
    throw new Error('Signatures must have same length');
  }

  let matches = 0;
  for (let i = 0; i < sig1.length; i++) {
    if (sig1[i] === sig2[i]) matches++;
  }

  return matches / sig1.length;
}

/**
 * Check if two names share any blocking key (are candidates)
 */
export function areBlockingCandidates(
  name1: string,
  name2: string,
  config: MinHashConfig = DEFAULT_CONFIG
): boolean {
  const keys1 = new Set(generateBlockingKeys(name1, config));
  const keys2 = generateBlockingKeys(name2, config);

  for (const k of keys2) {
    if (keys1.has(k)) return true;
  }

  return false;
}

// ============================================================================
// Blocking Index
// ============================================================================

/**
 * Build a blocking index for a list of company names
 * Returns a map from blocking key → set of company names
 */
export function buildBlockingIndex(
  names: string[],
  config: MinHashConfig = DEFAULT_CONFIG
): Map<string, Set<string>> {
  const index = new Map<string, Set<string>>();

  for (const name of names) {
    const keys = generateBlockingKeys(name, config);
    for (const key of keys) {
      if (!index.has(key)) {
        index.set(key, new Set());
      }
      index.get(key)!.add(name);
    }
  }

  return index;
}

/**
 * Find candidate matches for a name using the blocking index
 */
export function findCandidates(
  name: string,
  index: Map<string, Set<string>>,
  config: MinHashConfig = DEFAULT_CONFIG
): Set<string> {
  const candidates = new Set<string>();
  const keys = generateBlockingKeys(name, config);

  for (const key of keys) {
    const bucket = index.get(key);
    if (bucket) {
      for (const c of bucket) {
        candidates.add(c);
      }
    }
  }

  // Remove the query name itself if present
  candidates.delete(name);

  return candidates;
}

// ============================================================================
// Export key generator interface compatible with algorithms.ts
// ============================================================================

export const minHashBlockingGenerator = {
  name: 'minhash-lsh',
  description: 'MinHash LSH blocking keys (multiple keys per name)',
  generateKeys: (name: string, config?: MinHashConfig): string[] => {
    return generateBlockingKeys(name, config);
  },
  areMatches: (name1: string, name2: string, config?: MinHashConfig): boolean => {
    return areBlockingCandidates(name1, name2, config);
  }
};
