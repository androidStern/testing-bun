# Engineering Brief: Improving Second-Chance Job Detection

**Date:** December 25, 2025
**Project:** Recovery Jobs Platform - Scrape Pipeline
**Status:** Research & Design Phase

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Problem Statement](#problem-statement)
3. [Current Implementation](#current-implementation)
4. [Problem Domain Research](#problem-domain-research)
5. [Proposed Solution](#proposed-solution)
6. [Available Infrastructure](#available-infrastructure)
7. [Design Considerations & Tradeoffs](#design-considerations--tradeoffs)
8. [Implementation Recommendations](#implementation-recommendations)
9. [Complete Code Reference](#complete-code-reference)

---

## Executive Summary

The Recovery Jobs Platform scrapes job listings from Snagajob and enriches them with metadata to help job seekers with criminal backgrounds find employment. The current "second-chance" job detection system uses simple keyword matching on job descriptions, which has significant limitations.

**Goal:** Improve the accuracy and coverage of second-chance job detection by implementing a multi-signal scoring system that leverages:
1. Description keywords (current approach, refined)
2. Known employer database matching
3. Industry-level heuristics
4. O*NET occupational classification

---

## Problem Statement

### High-Level Problem

We need to accurately identify which jobs are "second-chance friendly" - meaning employers who are willing to hire people with criminal records. This is critical because:

1. Job seekers with records waste time applying to jobs that will reject them
2. Missing second-chance opportunities means fewer matches for our users
3. False positives damage trust and waste user effort

### Low-Level Technical Problem

The current detection system (`scrape-pipeline/lib/enrichment/second-chance.ts`) uses substring matching against a static list of ~60 keywords. This approach:

- **Misses** employers who don't use standard Fair Chance language but ARE second-chance friendly
- **Misses** jobs from known Fair Chance Pledge signatories who don't put keywords in every posting
- **Ignores** industry patterns (construction, trucking, food service are historically more open)
- **Ignores** available O*NET codes that could indicate entry-level/accessible positions
- **Has no confidence scoring** - a job either is or isn't flagged, no gradation

### Data Available But Unused

The Snagajob scraper extracts these fields that are **currently discarded**:

```typescript
// From SnagajobJob interface - scraped but NOT stored
industry?: string;           // e.g., "Food Service", "Construction"
industries?: string[];       // Full array of industry classifications
onetCode?: string;          // O*NET Standard Occupational Code
onetTitle?: string;         // O*NET job title
brandName?: string;         // National brand name (e.g., "McDonald's")
customerName?: string;      // Actual employer name
```

---

## Current Implementation

### Second-Chance Detection Code

**Location:** `/scrape-pipeline/lib/enrichment/second-chance.ts`

```typescript
/**
 * Second-Chance Employer Detection
 *
 * Identifies jobs that are friendly to people with criminal backgrounds
 * through keyword matching on job descriptions.
 */

export interface SecondChanceResult {
  isSecondChance: boolean;
  noBackgroundCheck: boolean;
  backgroundCheckRequired: boolean;
  drugTestRequired: boolean | null;
  signals: string[];
}

// Positive signals - employer is open to people with criminal backgrounds
const SECOND_CHANCE_POSITIVE = [
  // Fair Chance Act / Ban the Box (legally required language)
  "consider qualified applicants with arrest and conviction records",
  "consider qualified applicants with criminal histories",
  "will consider for employment qualified applicants with criminal histories",
  "consider employment of qualified applicants with arrest",
  "fair chance ordinance",
  "fair chance initiative",
  "fair chance act",
  "fair chance employer",
  "fair chance hiring",
  "ban the box",

  // Explicit second-chance statements
  "second chance employer",
  "second-chance employer",
  "second chance friendly",
  "felony friendly",
  "felon friendly",
  "we hire felons",
  "felons welcome",
  "felons encouraged to apply",

  // Criminal history assessment language
  "criminal record will not automatically disqualify",
  "criminal history will not automatically disqualify",
  "conviction will not automatically disqualify",
  "criminal record does not disqualify",
  "does not automatically bar",
  "individualized assessment",

  // Inclusive hiring for justice-involved
  "background friendly",
  "all backgrounds welcome",
  "open to all backgrounds",
  "justice-involved",
  "justice involved",
  "formerly incarcerated",
  "returning citizens",
  "reentry program",
  "re-entry program",
  "reentry friendly",
];

// Negative signals - background check is required
const BACKGROUND_CHECK_REQUIRED = [
  "must pass background check",
  "background check required",
  "criminal background check required",
  "subject to background check",
  "contingent upon background check",
  "contingent on background check",
  "pass a background investigation",
  "satisfactory background check",
  "clear background check",
  "background screening required",
  "pre-employment background check",
  "clean background required",
  "clean record required",
  "clean criminal record",
  "no felonies",
  "no felony convictions",
  "no criminal history",
];

// Drug test signals
const DRUG_TEST_REQUIRED = [
  "drug test required",
  "drug screen required",
  "drug-free workplace",
  "pre-employment drug test",
  "must pass drug test",
  "drug screening required",
  "subject to drug test",
];

const DRUG_TEST_NEGATIVE = [
  "no drug test",
  "drug test not required",
];

/**
 * Detect second-chance employer signals in job description
 */
export function detectSecondChance(description: string | undefined): SecondChanceResult {
  if (!description) {
    return {
      isSecondChance: false,
      noBackgroundCheck: false,
      backgroundCheckRequired: false,
      drugTestRequired: null,
      signals: [],
    };
  }

  const lowerDesc = description.toLowerCase();
  const signals: string[] = [];

  let isSecondChance = false;
  let backgroundCheckRequired = false;
  let drugTestRequired: boolean | null = null;

  // Check positive signals (second-chance friendly)
  for (const phrase of SECOND_CHANCE_POSITIVE) {
    if (lowerDesc.includes(phrase)) {
      isSecondChance = true;
      signals.push(`+${phrase}`);
    }
  }

  // Check background check requirements
  for (const phrase of BACKGROUND_CHECK_REQUIRED) {
    if (lowerDesc.includes(phrase)) {
      backgroundCheckRequired = true;
      signals.push(`-bg:${phrase}`);
    }
  }

  // Check drug test requirements
  for (const phrase of DRUG_TEST_REQUIRED) {
    if (lowerDesc.includes(phrase)) {
      drugTestRequired = true;
      signals.push(`-drug:${phrase}`);
    }
  }

  // Check for no drug test
  for (const phrase of DRUG_TEST_NEGATIVE) {
    if (lowerDesc.includes(phrase)) {
      drugTestRequired = false;
      signals.push(`+nodrug:${phrase}`);
    }
  }

  // Determine noBackgroundCheck status
  // True only if we found positive signals AND no background check phrases
  const noBackgroundCheck = isSecondChance && !backgroundCheckRequired;

  return {
    isSecondChance,
    noBackgroundCheck,
    backgroundCheckRequired,
    drugTestRequired,
    signals,
  };
}
```

### How It's Used in the Pipeline

**Location:** `/scrape-pipeline/lib/enrichment/index.ts`

```typescript
export async function enrichJob(
  job: SnagajobJob
): Promise<{ shifts: ShiftResult; secondChance: SecondChanceResult }> {
  const shifts = await extractShifts({
    id: job.id,
    title: job.title,
    description: job.descriptionText,
    workSchedule: job.workSchedule,
  });

  const secondChance = detectSecondChance(job.descriptionText);

  return { shifts, secondChance };
}
```

### Where Results Are Stored

**Convex Schema** (`convex/schema.ts`):
```typescript
scrapedJobs: defineTable({
  // ... other fields ...

  // Enrichment: Second-chance (legacy keyword detection)
  secondChance: v.optional(v.boolean()),
  // New multi-signal scoring
  secondChanceScore: v.optional(v.number()),
  secondChanceTier: v.optional(v.union(v.literal('high'), v.literal('medium'), v.literal('low'), v.literal('unlikely'), v.literal('unknown'))),
  secondChanceConfidence: v.optional(v.float64()),
})
```

**Typesense Schema** (`scrape-pipeline/lib/typesense.ts`):
```typescript
{ name: "second_chance", type: "bool", facet: true, optional: true },
{ name: "second_chance_score", type: "int32", optional: true },
{ name: "second_chance_tier", type: "string", facet: true, optional: true },
{ name: "second_chance_confidence", type: "float", optional: true },
```

---

## Problem Domain Research

### What Are "Second Chance" Employers?

Second-chance employment, also known as "fair chance hiring," refers to employers who actively consider job candidates with criminal records. Key terminology:

| Term | Meaning |
|------|---------|
| **Fair Chance Employer** | Employer committed to evaluating applicants with records |
| **Ban the Box** | Policy to remove criminal history questions from initial applications |
| **Second Chance** | Colloquial term for fair chance hiring |
| **Felon Friendly** | Informal term for employers open to hiring people with felonies |
| **Returning Citizens** | Advocacy term for formerly incarcerated people |
| **Justice-Involved** | Academic/policy term for people with criminal records |

### Legal Framework

**Federal:**
- EEOC guidance recommends "individualized assessment" rather than blanket exclusions
- Work Opportunity Tax Credit (WOTC) provides up to $9,600/year per qualified hire
- Fair Chance to Compete for Jobs Act (federal contractors)

**State/Local (relevant to Florida):**
- Florida does NOT have statewide Ban the Box for private employers
- Some Florida cities have local fair chance ordinances
- Many employers in Florida include Fair Chance Act language voluntarily

### Known Fair Chance Employers

**Fair Chance Business Pledge Signatories (~185 companies):**
- American Airlines, Coca-Cola, Facebook/Meta, Google, PepsiCo
- Starbucks, Uber, Walmart, Xerox, Koch Industries
- Many more: https://obamawhitehouse.archives.gov/issues/criminal-justice/fair-chance-pledge

**Companies Known to Hire People with Records:**
- **Retail:** Walmart, Target, Home Depot, Kroger, CVS, Costco, Kohl's, Dollar Tree
- **Food Service:** McDonald's, Starbucks, Chipotle, Subway, Popeyes
- **Logistics:** UPS, FedEx, Amazon, J.B. Hunt, Swift Transportation
- **Staffing:** TrueBlue (Labor Ready), Express Employment, Adecco, Randstad

### Industries Most Likely to Hire

Based on industry research, these sectors are historically more open to hiring people with records:

| Industry | Reason | Examples |
|----------|--------|----------|
| **Construction** | Labor shortage, skills-based | Tradesmen International |
| **Trucking/Logistics** | Driver shortage, background-dependent on offense type | J.B. Hunt (40% "felony-friendly") |
| **Food Service** | High turnover, entry-level focus | Fast food chains, restaurants |
| **Warehousing** | Physical labor, productivity-focused | Amazon FCs, distribution centers |
| **Manufacturing** | Skills-based, union representation | Various |
| **Hospitality** | High turnover, staffing needs | Hotels, resorts |

Industries LESS likely to hire (regulated):
- Healthcare (patient contact)
- Finance/Banking (fiduciary responsibility)
- Education (child contact)
- Government (security clearances)

---

## Proposed Solution

### Multi-Signal Scoring Architecture

Replace the binary `isSecondChance` boolean with a confidence-based scoring system:

```typescript
interface SecondChanceScore {
  score: number;           // 0-100 confidence score
  tier: 'high' | 'medium' | 'low' | 'unlikely';
  signals: SignalContribution[];
}

interface SignalContribution {
  source: 'description' | 'company' | 'industry' | 'occupation';
  signal: string;
  weight: number;
  confidence: 'high' | 'medium' | 'low';
}
```

### Signal Sources (Ranked by Reliability)

#### 1. Description Keywords (Current - Refine & Expand)

**Weight: 20-40 points per signal**

Keep existing approach but:
- Add more EEOC-recommended phrases
- Add negation handling ("NOT a second chance employer")
- Weight negative signals more heavily (if they say "no felonies", believe them)

```typescript
// High confidence positive signals (+40 points)
"fair chance employer"
"second chance employer"
"we hire felons"

// Medium confidence positive signals (+25 points)
"consider qualified applicants with criminal histories"
"individualized assessment"
"returning citizens"

// High confidence negative signals (-50 points)
"no felonies"
"clean criminal record required"
"no criminal history"
```

#### 2. Known Employer Database (High Value)

**Weight: 30-50 points for match**

Build a curated database of known second-chance employers:
- Fair Chance Pledge signatories
- Jails to Jobs employer network
- felonfriendly.us listed companies

Use the **existing company-matching infrastructure** (see below) to fuzzy-match scraped company names.

```typescript
// Known employers database entry
interface KnownEmployer {
  name: string;           // Canonical name
  aliases: string[];      // Alternative names
  confidence: 'high' | 'medium';  // How certain are we?
  source: string;         // Where did we get this info?
}

// Example entries
const KNOWN_EMPLOYERS: KnownEmployer[] = [
  { name: "Walmart", aliases: ["Wal-Mart", "Walmart Inc"], confidence: "high", source: "fair-chance-pledge" },
  { name: "Target", aliases: ["Target Corporation"], confidence: "high", source: "fair-chance-pledge" },
  { name: "Amazon", aliases: ["Amazon.com", "Amazon Warehouse"], confidence: "medium", source: "reported" },
];
```

#### 3. Industry Heuristics (Medium Value)

**Weight: 10-20 points**

Use the `industry` field from Snagajob API:

```typescript
const INDUSTRY_SCORES: Record<string, number> = {
  // Favorable industries
  "Construction": 20,
  "Food Service": 15,
  "Hospitality": 15,
  "Manufacturing": 15,
  "Transportation": 15,
  "Warehousing": 15,
  "Retail": 10,

  // Neutral industries
  "Customer Service": 5,
  "General Labor": 10,

  // Unfavorable industries (regulated)
  "Healthcare": -10,
  "Finance": -15,
  "Education": -20,
  "Government": -25,
};
```

#### 4. O*NET Classification (Medium Value)

**Weight: 5-15 points**

The Snagajob API provides O*NET codes (Standard Occupational Classification). Use these to identify:
- Entry-level positions (generally more flexible)
- Manual labor/production roles
- Food prep/service occupations

```typescript
// O*NET SOC code patterns
const FAVORABLE_ONET_PREFIXES = [
  "35-",  // Food Preparation and Serving
  "37-",  // Building and Grounds Cleaning
  "47-",  // Construction and Extraction
  "51-",  // Production
  "53-",  // Transportation and Material Moving
];

const UNFAVORABLE_ONET_PREFIXES = [
  "29-",  // Healthcare Practitioners
  "13-",  // Business and Financial Operations
  "25-",  // Education, Training, and Library
];
```

### Scoring Algorithm

```typescript
export function scoreSecondChance(job: {
  description?: string;
  company: string;
  industry?: string;
  onetCode?: string;
}): SecondChanceScore {
  const contributions: SignalContribution[] = [];

  // 1. Description signals (current logic, enhanced)
  const descSignals = detectDescriptionSignals(job.description);
  contributions.push(...descSignals);

  // 2. Known employer match
  const employerMatch = matchKnownEmployer(job.company);
  if (employerMatch) {
    contributions.push({
      source: 'company',
      signal: `known_employer:${employerMatch.name}`,
      weight: employerMatch.confidence === 'high' ? 40 : 25,
      confidence: employerMatch.confidence,
    });
  }

  // 3. Industry scoring
  const industryScore = INDUSTRY_SCORES[job.industry ?? ''] ?? 0;
  if (industryScore !== 0) {
    contributions.push({
      source: 'industry',
      signal: `industry:${job.industry}`,
      weight: industryScore,
      confidence: 'medium',
    });
  }

  // 4. O*NET classification
  if (job.onetCode) {
    for (const prefix of FAVORABLE_ONET_PREFIXES) {
      if (job.onetCode.startsWith(prefix)) {
        contributions.push({
          source: 'occupation',
          signal: `onet:${job.onetCode}`,
          weight: 10,
          confidence: 'low',
        });
        break;
      }
    }
  }

  // Calculate total score (capped at 100)
  const rawScore = contributions.reduce((sum, c) => sum + c.weight, 0);
  const score = Math.max(0, Math.min(100, rawScore));

  // Determine tier
  const tier = score >= 60 ? 'high'
             : score >= 35 ? 'medium'
             : score >= 15 ? 'low'
             : 'unlikely';

  return { score, tier, signals: contributions };
}
```

---

## Available Infrastructure

### Company Matching System

The codebase already has sophisticated company name matching infrastructure at `/scrape-pipeline/company-matching/`:

**Normalization** (`normalize.ts`):
```typescript
// Removes legal suffixes (Inc, LLC, Corp, etc.)
// Handles punctuation, spacing, case normalization
export function normalize(name: string): string;
```

**Matching Algorithms** (`algorithms.ts`):
- **Double Metaphone**: Phonetic matching (Smith == Schmidt)
- **Soundex**: Classic phonetic algorithm
- **Jaro-Winkler**: Edit distance with prefix weighting (recommended, 0.85 threshold)
- **Levenshtein**: Simple edit distance
- **Dice Coefficient**: Token-based similarity
- **Jaccard**: Set-based token similarity

```typescript
// Example: Match scraped company name to known employer
import { jaroWinklerScorer, matchByScore } from './algorithms';

const result = matchByScore(
  "Wal-Mart Corporation",  // Scraped name
  "Walmart",               // Known employer
  jaroWinklerScorer,
  0.85                     // Threshold
);
console.log(result.isMatch); // true
```

**MinHash LSH Blocking** (`minhash.ts`):
For large-scale matching (1000s of employers), use blocking to reduce comparisons:

```typescript
import { buildBlockingIndex, findCandidates } from './minhash';

// Build index once on known employers
const employers = ["Walmart", "Target", "Amazon", ...];
const index = buildBlockingIndex(employers);

// For each scraped job, get candidates
const candidates = findCandidates(scrapedJob.company, index);
// Then score only candidates with Jaro-Winkler
```

### Snagajob Data Available

The scraper already extracts these fields (but they're not stored):

```typescript
interface SnagajobJob {
  // Currently used
  id: string;
  company: string;
  title: string;
  descriptionText?: string;

  // Available but NOT stored - HIGH VALUE
  industry?: string;           // primaryIndustryName
  industries?: string[];       // Full array
  onetCode?: string;          // O*NET classification
  onetTitle?: string;         // O*NET title
  brandName?: string;         // National brand
  customerName?: string;      // Actual employer
}
```

### Convex Schema Updates Required

To store new fields:

```typescript
// Add to scrapedJobs table
industry: v.optional(v.string()),
industries: v.optional(v.array(v.string())),
onetCode: v.optional(v.string()),
onetTitle: v.optional(v.string()),

// Replace boolean with score
secondChanceScore: v.optional(v.number()),       // 0-100
secondChanceTier: v.optional(v.union(
  v.literal('high'),
  v.literal('medium'),
  v.literal('low'),
  v.literal('unlikely')
)),
secondChanceSignals: v.optional(v.array(v.string())),
```

---

## Design Considerations & Tradeoffs

### Option A: Pure Keyword Enhancement

**Approach:** Expand keyword lists, add negation handling, keep boolean output.

**Pros:**
- Minimal code changes
- No new dependencies
- Fast implementation

**Cons:**
- Still misses employers who don't use keywords
- No industry/company-level intelligence
- Binary output (no confidence gradation)

### Option B: Multi-Signal Scoring (Recommended)

**Approach:** Implement scoring system with multiple signal sources.

**Pros:**
- Much higher recall (catches more second-chance jobs)
- Confidence scoring helps users prioritize
- Leverages existing infrastructure
- Future-proof (easy to add new signals)

**Cons:**
- More complex implementation
- Requires employer database curation
- Schema changes needed
- More fields to index in Typesense

### Option C: ML-Based Classification

**Approach:** Train classifier on labeled job descriptions.

**Pros:**
- Could achieve highest accuracy
- Learns patterns humans miss
- Handles edge cases better

**Cons:**
- Requires labeled training data (don't have)
- Black box - harder to debug
- Ongoing maintenance burden
- May not be worth complexity for this use case

### Recommended: Option B

Multi-signal scoring provides the best balance of:
- Improvement over current approach
- Reasonable implementation complexity
- Leverages existing infrastructure
- Extensible for future enhancements

---

## Implementation Recommendations

### Phase 1: Quick Wins (Low Effort, High Impact)

1. **Store industry/onetCode in Convex** - Already scraped, just not saved
2. **Add known employer lookup** - Simple JSON file with ~200 major employers
3. **Industry score boost** - Add +10-20 for favorable industries

### Phase 2: Core Scoring System

1. **Implement `scoreSecondChance()`** function
2. **Update Convex schema** with score/tier/signals fields
3. **Update Typesense schema** with new indexed fields
4. **Modify enrichment pipeline** to use new scoring

### Phase 3: Company Matching Integration

1. **Curate employer database** from multiple sources
2. **Integrate with existing company-matching** infrastructure
3. **Build blocking index** for efficient lookup

### Phase 4: Refinement

1. **Tune weights** based on real-world accuracy
2. **Add UI for confidence tiers** (high/medium/low badges)
3. **A/B test** new vs old approach

---

## Complete Code Reference

### File Locations

| File | Purpose | Lines |
|------|---------|-------|
| `scrape-pipeline/lib/enrichment/second-chance.ts` | Current detection | 185 |
| `scrape-pipeline/lib/enrichment/index.ts` | Enrichment exports | 63 |
| `scrape-pipeline/scrapers/snagajob.ts` | Job scraper | 525 |
| `scrape-pipeline/company-matching/algorithms.ts` | Matching algos | 266 |
| `scrape-pipeline/company-matching/normalize.ts` | Name normalization | 93 |
| `scrape-pipeline/company-matching/minhash.ts` | LSH blocking | 329 |
| `scrape-pipeline/lib/typesense.ts` | Search indexing | 290 |
| `scrape-pipeline/lib/convex.ts` | Convex HTTP client | 176 |
| `convex/schema.ts` | Database schema | 326 |
| `convex/scrapedJobs.ts` | Job mutations | 320 |
| `convex/http.ts` | HTTP endpoints | 360 |

### Data Flow

```
Snagajob API
    ↓
scrapeSnagajobListings() - Get basic job info
    ↓
enrichJobDetails() - Fetch full descriptions + industry + O*NET
    ↓
[NEW] scoreSecondChance() - Multi-signal scoring
    ↓
insertJob() → Convex (store with score/tier/signals)
    ↓
indexJob() → Typesense (enable filtering by tier)
```

### External Resources

**Employer Lists:**
- Fair Chance Pledge: https://obamawhitehouse.archives.gov/issues/criminal-justice/fair-chance-pledge
- Jails to Jobs: https://jailstojobs.org/resources/second-chance-employers-network/
- Felon Friendly: https://felonfriendly.us/jobs/list-of-companies-that-hire-felons/

**Legal/Policy:**
- EEOC Guidance: https://www.eeoc.gov/arrestandconviction
- NELP Ban the Box Guide: https://www.nelp.org/insights-research/ban-the-box-fair-chance-hiring-state-and-local-guide/

**O*NET:**
- SOC Codes: https://www.onetonline.org/

---

## Questions for Engineering Team

1. **Threshold calibration:** How should we set score thresholds for high/medium/low tiers?
2. **UI display:** How should confidence tiers be shown to job seekers?
3. **Employer database curation:** Who maintains and updates the known employer list?
4. **Negative signals:** Should we have an "unlikely" tier for jobs with explicit exclusions?
5. **Performance:** At what scale do we need MinHash blocking vs. simple iteration?

---

*Document prepared for engineering team review. Contact product for clarification on requirements.*
