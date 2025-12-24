import Typesense from "typesense";
import type { CollectionCreateSchema } from "typesense/lib/Typesense/Collections";
import type { SnagajobJob } from "../scrapers/snagajob";
import type { TransitScore } from "../transit-scorer";
import type { ShiftResult } from "./enrichment/shift-extractor";
import type { SecondChanceResult } from "./enrichment/second-chance";

let client: Typesense.Client | null = null;

export function getTypesense(): Typesense.Client {
  if (!client) {
    const typesenseUrl = process.env.TYPESENSE_URL;
    const apiKey = process.env.TYPESENSE_API_KEY;

    if (!typesenseUrl) {
      throw new Error("TYPESENSE_URL environment variable is required");
    }
    if (!apiKey) {
      throw new Error("TYPESENSE_API_KEY environment variable is required");
    }

    const url = new URL(typesenseUrl);
    client = new Typesense.Client({
      nodes: [
        {
          host: url.hostname,
          port: parseInt(url.port) || 8108,
          protocol: url.protocol.replace(":", "") as "http" | "https",
        },
      ],
      apiKey,
      connectionTimeoutSeconds: 10,
    });
  }
  return client;
}

export const JOBS_COLLECTION = "jobs";

export const jobsSchema: CollectionCreateSchema = {
  name: JOBS_COLLECTION,
  fields: [
    { name: "id", type: "string" },
    { name: "external_id", type: "string" },
    { name: "source", type: "string", facet: true },
    { name: "title", type: "string" },
    { name: "company", type: "string", facet: true },
    { name: "description", type: "string", optional: true },
    { name: "location", type: "geopoint", optional: true },
    { name: "city", type: "string", facet: true, optional: true },
    { name: "state", type: "string", facet: true, optional: true },
    { name: "salary_min", type: "int32", optional: true },
    { name: "salary_max", type: "int32", optional: true },
    { name: "salary_type", type: "string", optional: true },

    // Transit (from existing transit-scorer.ts)
    { name: "transit_score", type: "int32", optional: true },
    { name: "transit_distance", type: "float", optional: true },
    { name: "bus_accessible", type: "bool", facet: true, optional: true },
    { name: "rail_accessible", type: "bool", facet: true, optional: true },

    // Recovery-specific enrichment
    { name: "shift_morning", type: "bool", facet: true, optional: true },
    { name: "shift_afternoon", type: "bool", facet: true, optional: true },
    { name: "shift_evening", type: "bool", facet: true, optional: true },
    { name: "shift_overnight", type: "bool", facet: true, optional: true },
    { name: "shift_flexible", type: "bool", facet: true, optional: true },
    { name: "second_chance", type: "bool", facet: true, optional: true },
    { name: "no_background_check", type: "bool", facet: true, optional: true },

    // Job metadata
    { name: "is_urgent", type: "bool", facet: true, optional: true },
    { name: "is_easy_apply", type: "bool", facet: true, optional: true },
    { name: "url", type: "string" },
    { name: "posted_at", type: "int64" },
  ],
  default_sorting_field: "posted_at",
};

export async function ensureJobsCollection(): Promise<void> {
  const typesense = getTypesense();

  try {
    await typesense.collections(JOBS_COLLECTION).retrieve();
    console.log("[Typesense] Collection 'jobs' already exists");
  } catch (err: any) {
    if (err?.httpStatus === 404) {
      console.log("[Typesense] Creating 'jobs' collection...");
      await typesense.collections().create(jobsSchema);
      console.log("[Typesense] Collection 'jobs' created");
    } else {
      throw err;
    }
  }
}

export interface EnrichedJob extends SnagajobJob {
  transit?: TransitScore;
  shifts?: ShiftResult;
  secondChance?: SecondChanceResult;
}

export interface TypesenseJobDocument {
  id: string;
  external_id: string;
  source: string;
  title: string;
  company: string;
  description?: string;
  location?: [number, number]; // [lat, lng]
  city?: string;
  state?: string;
  salary_min?: number;
  salary_max?: number;
  salary_type?: string;
  transit_score?: number;
  transit_distance?: number;
  bus_accessible?: boolean;
  rail_accessible?: boolean;
  shift_morning?: boolean;
  shift_afternoon?: boolean;
  shift_evening?: boolean;
  shift_overnight?: boolean;
  shift_flexible?: boolean;
  second_chance?: boolean;
  no_background_check?: boolean;
  is_urgent?: boolean;
  is_easy_apply?: boolean;
  url: string;
  posted_at: number;
}

export function toTypesenseDocument(
  job: EnrichedJob,
  source: string = "snagajob"
): TypesenseJobDocument {
  const doc: TypesenseJobDocument = {
    id: `${source}-${job.id}`,
    external_id: job.id,
    source,
    title: job.title,
    company: job.company,
    url: job.applyUrl || "",
    posted_at: job.postedDate
      ? new Date(job.postedDate).getTime()
      : Date.now(),
  };

  // Location
  if (job.latitude && job.longitude) {
    doc.location = [job.latitude, job.longitude];
  }
  if (job.city) doc.city = job.city;
  if (job.state) doc.state = job.state;

  // Description
  if (job.descriptionText) {
    doc.description = job.descriptionText.substring(0, 10000); // Truncate long descriptions
  }

  // Salary
  if (job.payMin) doc.salary_min = Math.round(job.payMin);
  if (job.payMax) doc.salary_max = Math.round(job.payMax);
  if (job.payType) {
    // payType from snagajob API is numeric (1=hourly, etc)
    const payTypeMap: Record<string | number, string> = {
      1: "hourly",
      2: "salary",
      3: "daily",
      "hourly": "hourly",
      "salary": "salary",
      "daily": "daily",
    };
    doc.salary_type = payTypeMap[job.payType] || String(job.payType);
  }

  // Transit enrichment
  if (job.transit) {
    // Convert letter grade to numeric score (0-100)
    const scoreMap: Record<string, number> = {
      'A+': 100,
      'A': 85,
      'B': 70,
      'C': 50,
      'D': 25,
    };
    doc.transit_score = scoreMap[job.transit.score] ?? 0;
    doc.transit_distance = job.transit.distanceMiles;
    doc.bus_accessible = !job.transit.nearbyRail && job.transit.nearbyStops > 0;
    doc.rail_accessible = job.transit.nearbyRail;
  }

  // Shift enrichment
  if (job.shifts) {
    doc.shift_morning = job.shifts.morning;
    doc.shift_afternoon = job.shifts.afternoon;
    doc.shift_evening = job.shifts.evening;
    doc.shift_overnight = job.shifts.overnight;
    doc.shift_flexible = job.shifts.flexible;
  }

  // Second chance enrichment
  if (job.secondChance) {
    doc.second_chance = job.secondChance.isSecondChance;
    doc.no_background_check = job.secondChance.noBackgroundCheck;
  }

  // Job metadata
  doc.is_urgent = job.isUrgent;
  doc.is_easy_apply = job.isEasyApply;

  return doc;
}

export async function indexJob(job: EnrichedJob, source: string = "snagajob"): Promise<void> {
  const typesense = getTypesense();
  const doc = toTypesenseDocument(job, source);
  await typesense.collections(JOBS_COLLECTION).documents().upsert(doc);
}

export async function indexJobs(jobs: EnrichedJob[], source: string = "snagajob"): Promise<{ success: number; failed: number }> {
  const typesense = getTypesense();
  const docs = jobs.map((job) => toTypesenseDocument(job, source));

  const results = await typesense
    .collections(JOBS_COLLECTION)
    .documents()
    .import(docs, { action: "upsert" });

  let success = 0;
  let failed = 0;

  for (const result of results) {
    if (result.success) {
      success++;
    } else {
      failed++;
      console.error("[Typesense] Failed to index job:", result.error);
    }
  }

  // Throw if ALL jobs failed to index - indicates a systemic problem
  if (failed > 0 && failed === results.length) {
    throw new Error(`All ${failed} jobs failed to index to Typesense`);
  }

  return { success, failed };
}

/**
 * Delete a single job from Typesense by its document ID
 * Document ID format: `${source}-${externalId}`
 */
export async function deleteJobDocument(typesenseId: string): Promise<void> {
  const typesense = getTypesense();
  await typesense.collections(JOBS_COLLECTION).documents(typesenseId).delete();
  console.log(`[Typesense] Deleted job: ${typesenseId}`);
}

/**
 * Delete multiple jobs from Typesense
 * Returns counts of successful and failed deletions
 */
export async function deleteJobDocuments(
  typesenseIds: string[]
): Promise<{ success: number; failed: number; errors: string[] }> {
  const typesense = getTypesense();
  let success = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const id of typesenseIds) {
    try {
      await typesense.collections(JOBS_COLLECTION).documents(id).delete();
      success++;
    } catch (err: any) {
      if (err?.httpStatus === 404) {
        // Already deleted, count as success
        success++;
      } else {
        failed++;
        errors.push(`${id}: ${err.message}`);
      }
    }
  }

  console.log(`[Typesense] Deleted ${success}/${typesenseIds.length} jobs`);
  return { success, failed, errors };
}
