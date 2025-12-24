/**
 * Company name normalization utilities
 * Preprocesses company names before matching algorithms
 */

// Legal suffixes and common business terms to strip
const LEGAL_SUFFIXES = [
  'inc', 'incorporated', 'corp', 'corporation', 'co', 'company', 'companies',
  'llc', 'llp', 'ltd', 'limited', 'plc', 'gmbh', 'ag', 'sa', 'nv', 'bv',
  'group', 'holdings', 'holding', 'enterprises', 'enterprise',
  'international', 'intl', 'global', 'worldwide',
  'usa', 'us', 'america', 'americas',
  'services', 'service', 'solutions', 'solution',
  'technologies', 'technology', 'tech',
  'industries', 'industry',
  'partners', 'partner', 'partnership',
  'associates', 'associate',
  'brands', 'brand',
  'stores', 'store', 'retail',
  'restaurants', 'restaurant',
  'foods', 'food', 'beverages', 'beverage',
  'the'
];

// Build regex pattern for suffix removal
const SUFFIX_PATTERN = new RegExp(
  `\\b(${LEGAL_SUFFIXES.join('|')})\\b`,
  'gi'
);

/**
 * Normalize a company name for matching
 * @param name Raw company name
 * @returns Normalized name
 */
export function normalize(name: string): string {
  if (!name) return '';

  return name
    // Convert to lowercase
    .toLowerCase()
    // Remove apostrophes and curly quotes
    .replace(/['''`]/g, '')
    // Replace & with 'and' for consistency
    .replace(/&/g, ' and ')
    // Replace hyphens and dashes with space
    .replace(/[-–—]/g, ' ')
    // Remove periods (for abbreviations like Inc.)
    .replace(/\./g, '')
    // Remove commas
    .replace(/,/g, '')
    // Remove other punctuation
    .replace(/[^\w\s]/g, ' ')
    // Remove legal suffixes
    .replace(SUFFIX_PATTERN, '')
    // Collapse multiple spaces
    .replace(/\s+/g, ' ')
    // Trim
    .trim();
}

/**
 * Normalize for phonetic matching (more aggressive)
 * Removes all numbers and keeps only alphabetic characters
 */
export function normalizeForPhonetic(name: string): string {
  const normalized = normalize(name);
  return normalized
    // Remove numbers
    .replace(/\d+/g, '')
    // Remove single characters (often initials or artifacts)
    .replace(/\b\w\b/g, '')
    // Collapse spaces again
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Extract tokens from a company name (for token-based matching)
 */
export function tokenize(name: string): string[] {
  return normalize(name)
    .split(/\s+/)
    .filter(token => token.length > 0);
}

/**
 * Generate a simple normalized key (useful for exact deduplication after normalization)
 */
export function normalizedKey(name: string): string {
  return normalize(name).replace(/\s+/g, '');
}
