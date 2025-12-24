/**
 * Modular Shift Extraction System
 *
 * Designed for easy upgrade path to Claude AI while supporting
 * multiple job sources with different data shapes.
 *
 * Strategy pattern: Each extractor implements canHandle() and extract().
 * The main extractShifts() function tries each in order until one handles the job.
 */

// Generic job input - works with any scraper source
export interface JobInput {
  id: string;
  title?: string;
  description?: string;
  // Snagajob-specific (optional)
  workSchedule?: string[];
  // Other sources can add their own fields
  [key: string]: unknown;
}

export interface ShiftResult {
  morning: boolean;
  afternoon: boolean;
  evening: boolean;
  overnight: boolean;
  flexible: boolean;
  source: "workSchedule" | "ai" | "regex" | "unknown";
}

// Base interface - all extractors implement this
interface ShiftExtractor {
  name: string;
  canHandle(job: JobInput): boolean;
  extract(job: JobInput): Promise<ShiftResult>;
}

// Common shift keywords for pattern matching
const SHIFT_PATTERNS = {
  morning: [
    /\bmorning\b/i,
    /\bam\s*shift/i,
    /\b[5-9]\s*am\b/i,
    /\b1[0-1]\s*am\b/i,
    /\bday\s*shift/i,
    /\bfirst\s*shift/i,
    /\b1st\s*shift/i,
    /\bopening\s*shift/i,
    /\bearly\s*morning/i,
  ],
  afternoon: [
    /\bafternoon\b/i,
    /\bmid\s*day/i,
    /\b1[2-5]\s*pm\b/i,
    /\bsecond\s*shift/i,
    /\b2nd\s*shift/i,
    /\bswing\s*shift/i,
  ],
  evening: [
    /\bevening\b/i,
    /\bnight\s*shift/i,
    /\bpm\s*shift/i,
    /\b[5-9]\s*pm\b/i,
    /\b1[0-1]\s*pm\b/i,
    /\bthird\s*shift/i,
    /\b3rd\s*shift/i,
    /\bclosing\s*shift/i,
  ],
  overnight: [
    /\bovernight\b/i,
    /\bgraveyard/i,
    /\b12\s*am\b/i,
    /\bmidnight/i,
    /\bover\s*night/i,
    /\ball\s*night/i,
    /\b1[2]\s*am\s*-/i,
  ],
  flexible: [
    /\bflexible\s*(hours|schedule|shifts?)/i,
    /\bvaries\b/i,
    /\bopen\s*availability/i,
    /\bself[\s-]?schedul/i,
    /\bchoose\s*your\s*(own\s*)?(hours|schedule)/i,
    /\bset\s*your\s*own/i,
    /\bpart[\s-]?time/i,
  ],
};

/**
 * Snagajob WorkSchedule Extractor
 *
 * Maps the workSchedule array from Snagajob's API to shift booleans.
 * Common values: "Day Shift", "Evening Shift", "Night Shift", "Overnight Shift",
 * "Weekends", "Flexible", "Rotating"
 */
class SnagajobShiftExtractor implements ShiftExtractor {
  name = "snagajob-workSchedule";

  canHandle(job: JobInput): boolean {
    return Array.isArray(job.workSchedule) && job.workSchedule.length > 0;
  }

  async extract(job: JobInput): Promise<ShiftResult> {
    const schedule = job.workSchedule!;
    const scheduleText = schedule.join(" ").toLowerCase();

    const result: ShiftResult = {
      morning: false,
      afternoon: false,
      evening: false,
      overnight: false,
      flexible: false,
      source: "workSchedule",
    };

    // Map common Snagajob workSchedule values
    for (const item of schedule) {
      const lower = item.toLowerCase();

      if (lower.includes("day") || lower.includes("morning")) {
        result.morning = true;
      }
      if (lower.includes("afternoon") || lower.includes("mid")) {
        result.afternoon = true;
      }
      if (lower.includes("evening") || lower.includes("night shift")) {
        result.evening = true;
      }
      if (lower.includes("overnight") || lower.includes("graveyard")) {
        result.overnight = true;
      }
      if (
        lower.includes("flexible") ||
        lower.includes("varies") ||
        lower.includes("rotating")
      ) {
        result.flexible = true;
      }
    }

    // If "Night Shift" without "Overnight", it's evening
    if (scheduleText.includes("night") && !result.overnight && !result.evening) {
      result.evening = true;
    }

    return result;
  }
}

/**
 * Claude AI Shift Extractor (PLACEHOLDER)
 *
 * Uncomment and implement when ready to upgrade to AI-based extraction.
 * Uses Claude to analyze job descriptions and extract shift information.
 */
// class ClaudeShiftExtractor implements ShiftExtractor {
//   name = "claude-ai";
//
//   canHandle(job: JobInput): boolean {
//     return !!job.description && job.description.length > 50;
//   }
//
//   async extract(job: JobInput): Promise<ShiftResult> {
//     // TODO: Implement Claude API call with prompt caching
//     // const response = await anthropic.messages.create({
//     //   model: "claude-sonnet-4-20250514",
//     //   max_tokens: 200,
//     //   system: [{ type: "text", text: SHIFT_EXTRACTION_PROMPT, cache_control: { type: "ephemeral" } }],
//     //   messages: [{ role: "user", content: `Title: ${job.title}\nDescription: ${job.description}` }]
//     // });
//     throw new Error("ClaudeShiftExtractor not implemented");
//   }
// }

/**
 * Regex Fallback Extractor
 *
 * Uses pattern matching on title and description as a last resort.
 * Less accurate but doesn't require external APIs.
 */
class RegexShiftExtractor implements ShiftExtractor {
  name = "regex-fallback";

  canHandle(job: JobInput): boolean {
    return !!(job.description || job.title);
  }

  async extract(job: JobInput): Promise<ShiftResult> {
    const text = `${job.title || ""} ${job.description || ""}`;

    const result: ShiftResult = {
      morning: false,
      afternoon: false,
      evening: false,
      overnight: false,
      flexible: false,
      source: "regex",
    };

    // Check each shift pattern
    for (const pattern of SHIFT_PATTERNS.morning) {
      if (pattern.test(text)) {
        result.morning = true;
        break;
      }
    }

    for (const pattern of SHIFT_PATTERNS.afternoon) {
      if (pattern.test(text)) {
        result.afternoon = true;
        break;
      }
    }

    for (const pattern of SHIFT_PATTERNS.evening) {
      if (pattern.test(text)) {
        result.evening = true;
        break;
      }
    }

    for (const pattern of SHIFT_PATTERNS.overnight) {
      if (pattern.test(text)) {
        result.overnight = true;
        break;
      }
    }

    for (const pattern of SHIFT_PATTERNS.flexible) {
      if (pattern.test(text)) {
        result.flexible = true;
        break;
      }
    }

    return result;
  }
}

// Registry of extractors in priority order
const extractors: ShiftExtractor[] = [
  new SnagajobShiftExtractor(),
  // new ClaudeShiftExtractor(),  // Uncomment when ready
  new RegexShiftExtractor(),
];

/**
 * Main shift extraction function
 *
 * Tries each extractor in priority order until one can handle the job.
 * Returns unknown result if no extractor can handle it.
 */
export async function extractShifts(job: JobInput): Promise<ShiftResult> {
  for (const extractor of extractors) {
    if (extractor.canHandle(job)) {
      // Let errors propagate - don't silently fall through to next extractor
      const result = await extractor.extract(job);
      return result;
    }
  }

  // No extractor could handle this job
  return {
    morning: false,
    afternoon: false,
    evening: false,
    overnight: false,
    flexible: true, // Mark as flexible when unknown
    source: "unknown",
  };
}

/**
 * Batch extract shifts for multiple jobs
 */
export async function extractShiftsBatch(jobs: JobInput[]): Promise<Map<string, ShiftResult>> {
  const results = new Map<string, ShiftResult>();

  for (const job of jobs) {
    const result = await extractShifts(job);
    results.set(job.id, result);
  }

  return results;
}
