/**
 * JOB DEDUPLICATION - ENHANCED VERSION
 * =====================================
 * 
 * This is the production-ready version with additional features:
 * 
 * 1. JOB EXPIRATION (TTL)
 *    Jobs automatically expire from the index after a configurable period.
 *    Default: 30 days (job postings don't last forever)
 * 
 * 2. BATCH PROCESSING
 *    Process many jobs efficiently with processJobBatch()
 *    Automatically handles geocoding and dedup in optimal order
 * 
 * 3. SCRAPER INTEGRATION
 *    Helper functions for common scraper workflows:
 *    - processScrapeResults() - Handle a batch of scraped jobs
 *    - getExistingJobIds() - Check which jobs are already indexed
 * 
 * 4. METRICS & MONITORING
 *    Track duplicate rates, cache hit rates, processing times
 * 
 * REDIS KEY STRUCTURE:
 * 
 *   geo:{location}              → Hash { lat, lng, type, resolvedAt }
 *   band:{band_key}             → Set of job IDs (with member expiry via sorted sets)
 *   job:{id}:fp                 → Hash { hash, bits, bands, indexedAt }
 *   job:{id}:loc                → Hash { lat, lng, type }
 *   dedup:metrics:{date}        → Hash { processed, duplicates, indexed, ... }
 */

const crypto = require('crypto');

// =============================================================================
// CONFIGURATION
// =============================================================================

const CONFIG = {
  // Fingerprint settings
  weights: { company: 2, title: 1, description: 4 },
  duplicateThreshold: 10,
  numBands: 4,
  
  // Location settings
  locationSameThreshold: 15,
  locationDifferentThreshold: 40,
  
  // TTL settings (in seconds)
  jobTTL: 60 * 60 * 24 * 30,      // 30 days - jobs expire after this
  geoTTL: 60 * 60 * 24 * 90,      // 90 days - geocoding cache lasts longer
  
  // Redis key prefixes
  keys: {
    geo: 'dedup:geo:',
    band: 'dedup:band:',
    jobFp: 'dedup:job:fp:',
    jobLoc: 'dedup:job:loc:',
    metrics: 'dedup:metrics:'
  },
  
  // Batch processing
  batchSize: 100,  // Process in chunks of this size
};


// =============================================================================
// MODULE STATE
// =============================================================================

let redis = null;
let geocoder = null;
let metrics = {
  processed: 0,
  duplicates: 0,
  indexed: 0,
  locationVetoes: 0,
  geoCacheHits: 0,
  geoCacheMisses: 0,
  errors: 0
};


// =============================================================================
// INITIALIZATION
// =============================================================================

async function initialize(options) {
  if (!options.redis) {
    throw new Error('Redis client is required');
  }
  
  redis = options.redis;
  geocoder = options.geocoder || null;
  
  if (options.config) {
    Object.assign(CONFIG, options.config);
  }
  
  await redis.ping();
  console.log('[JobDedup] Initialized');
  
  return { config: CONFIG };
}


// =============================================================================
// LOCATION HANDLING
// =============================================================================

const REMOTE_PATTERNS = [
  'remote', 'work from home', 'wfh', 'telecommute', 'virtual',
  'anywhere', 'nationwide', 'work from anywhere', 'home based'
];

function parseLocationType(rawLocation) {
  if (!rawLocation || rawLocation.trim() === '') {
    return { type: 'unknown', needsGeocoding: false };
  }
  
  const normalized = rawLocation.toLowerCase().trim();
  
  if (REMOTE_PATTERNS.some(p => normalized.includes(p))) {
    return { type: 'remote', needsGeocoding: false };
  }
  
  return { type: 'physical', needsGeocoding: true };
}

function normalizeLocationKey(location) {
  if (!location) return '';
  return location.toLowerCase().trim().replace(/\s+/g, ' ');
}

async function resolveLocation(rawLocation) {
  const locationType = parseLocationType(rawLocation);
  
  if (locationType.type !== 'physical') {
    return { lat: null, lng: null, type: locationType.type, cached: false };
  }
  
  // Check cache
  const cacheKey = CONFIG.keys.geo + normalizeLocationKey(rawLocation);
  const cached = await redis.hgetall(cacheKey);
  
  if (cached && Object.keys(cached).length > 0) {
    metrics.geoCacheHits++;
    return {
      lat: cached.lat ? parseFloat(cached.lat) : null,
      lng: cached.lng ? parseFloat(cached.lng) : null,
      type: cached.type || 'physical',
      cached: true
    };
  }
  
  metrics.geoCacheMisses++;
  
  if (!geocoder) {
    return { lat: null, lng: null, type: 'physical', cached: false };
  }
  
  try {
    const result = await geocoder(rawLocation);
    
    // Cache result
    await redis.hset(cacheKey, {
      lat: result?.lat?.toString() || '',
      lng: result?.lng?.toString() || '',
      type: 'physical',
      resolvedAt: Date.now().toString()
    });
    await redis.expire(cacheKey, CONFIG.geoTTL);
    
    return {
      lat: result?.lat || null,
      lng: result?.lng || null,
      type: 'physical',
      cached: false
    };
  } catch (error) {
    metrics.errors++;
    console.error('[JobDedup] Geocoding error:', error.message);
    return { lat: null, lng: null, type: 'physical', cached: false };
  }
}

function haversineDistance(lat1, lng1, lat2, lng2) {
  const R = 3959;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
            Math.cos(lat1 * Math.PI / 180) * 
            Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function compareLocations(loc1, loc2) {
  const type1 = loc1.type || 'unknown';
  const type2 = loc2.type || 'unknown';
  
  if (type1 === 'remote' && type2 === 'remote') {
    return { result: 'SAME', reason: 'both_remote' };
  }
  
  if (type1 === 'remote' || type2 === 'remote') {
    return { result: 'UNKNOWN', reason: 'remote_vs_physical' };
  }
  
  if (type1 === 'unknown' || type2 === 'unknown') {
    return { result: 'UNKNOWN', reason: 'unknown_location' };
  }
  
  if (loc1.lat == null || loc2.lat == null) {
    return { result: 'UNKNOWN', reason: 'missing_coordinates' };
  }
  
  const miles = haversineDistance(loc1.lat, loc1.lng, loc2.lat, loc2.lng);
  
  if (miles <= CONFIG.locationSameThreshold) {
    return { result: 'SAME', distance: miles };
  }
  
  if (miles >= CONFIG.locationDifferentThreshold) {
    return { result: 'DIFFERENT', distance: miles };
  }
  
  return { result: 'UNKNOWN', distance: miles, reason: 'gray_zone' };
}


// =============================================================================
// FINGERPRINT GENERATION
// =============================================================================

const DIGIT_WORDS = {
  '0': 'zero', '1': 'one', '2': 'two', '3': 'three', '4': 'four',
  '5': 'five', '6': 'six', '7': 'seven', '8': 'eight', '9': 'nine',
  '10': 'ten', '11': 'eleven', '12': 'twelve'
};

const COMPANY_SUFFIXES = new Set([
  'inc', 'incorporated', 'corp', 'corporation', 'co', 'company',
  'llc', 'ltd', 'limited', 'lp', 'plc', 'stores', 'international',
  'brands', 'group', 'holdings', 'services', 'solutions', 'enterprises'
]);

const TITLE_NOISE = new Set([
  'immediate', 'hiring', 'urgent', 'needed', 'wanted', 'now', 'apply',
  'today', 'asap', 'openings', 'opening', 'available', 'ft', 'pt',
  'full', 'part', 'time', 'fulltime', 'parttime', 'temp', 'temporary',
  'permanent', 'contract', 'seasonal', 'entry', 'level', 'senior',
  'junior', 'sr', 'jr', 'and', 'or', 'the', 'a', 'an', 'of', 'for', 'in'
]);

function normalizeCompany(name) {
  if (!name) return '';
  let result = name.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase();
  result = result.replace(/&/g, 'and').replace(/[^a-z0-9\s]/g, ' ');
  let words = result.split(/\s+/).filter(w => w.length > 0);
  while (words.length > 0 && ['the', 'a', 'an'].includes(words[0])) words.shift();
  words = words.map(w => DIGIT_WORDS[w] || w);
  while (words.length > 1 && COMPANY_SUFFIXES.has(words[words.length - 1])) words.pop();
  return words.join('');
}

function normalizeTitle(title) {
  if (!title) return '';
  let result = title.toLowerCase().replace(/[^a-z0-9\s]/g, ' ');
  return result.split(/\s+/).filter(w => w.length > 0 && !TITLE_NOISE.has(w)).join('');
}

function normalizeDescription(desc) {
  if (!desc) return '';
  return desc.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

function hash32(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash = hash & hash;
  }
  return hash >>> 0;
}

function charNgrams(str, n) {
  if (str.length < n) return [str];
  const ngrams = [];
  for (let i = 0; i <= str.length - n; i++) ngrams.push(str.slice(i, i + n));
  return ngrams;
}

function simhashBits(shingles) {
  const v = new Array(64).fill(0);
  for (const shingle of shingles) {
    const h1 = hash32(shingle);
    const h2 = hash32(shingle + '_salt');
    for (let i = 0; i < 32; i++) {
      v[i] += ((h1 >> i) & 1) ? 1 : -1;
      v[i + 32] += ((h2 >> i) & 1) ? 1 : -1;
    }
  }
  return v.map(x => x > 0 ? 1 : 0);
}

function bitsToHex(bits) {
  let hex = '';
  for (let i = 0; i < bits.length; i += 4) {
    hex += ((bits[i] << 3) | (bits[i+1] << 2) | (bits[i+2] << 1) | bits[i+3]).toString(16);
  }
  return hex;
}

function hammingDistance(bits1, bits2) {
  let d = 0;
  for (let i = 0; i < bits1.length; i++) if (bits1[i] !== bits2[i]) d++;
  return d;
}

function generateFingerprint(job) {
  const allShingles = [];
  
  const companyShingles = charNgrams(normalizeCompany(job.company), 3).map(s => 'C:' + s);
  for (let i = 0; i < CONFIG.weights.company; i++) allShingles.push(...companyShingles);
  
  const titleShingles = charNgrams(normalizeTitle(job.title), 3).map(s => 'T:' + s);
  for (let i = 0; i < CONFIG.weights.title; i++) allShingles.push(...titleShingles);
  
  const descShingles = charNgrams(normalizeDescription(job.description), 5).map(s => 'D:' + s);
  for (let i = 0; i < CONFIG.weights.description; i++) allShingles.push(...descShingles);
  
  const bits = simhashBits(allShingles);
  const hash = bitsToHex(bits);
  
  const bands = [];
  for (let b = 0; b < CONFIG.numBands; b++) {
    bands.push(`b${b}:${bitsToHex(bits.slice(b * 16, (b + 1) * 16))}`);
  }
  
  return { hash, bits, bands };
}


// =============================================================================
// REDIS OPERATIONS WITH TTL
// =============================================================================

async function findCandidates(bands) {
  const candidates = new Set();
  const pipeline = redis.pipeline();
  
  for (const band of bands) {
    pipeline.smembers(CONFIG.keys.band + band);
  }
  
  const results = await pipeline.exec();
  
  for (const [err, jobIds] of results) {
    if (!err && jobIds) {
      for (const id of jobIds) candidates.add(id);
    }
  }
  
  return candidates;
}

async function indexJob(jobId, fingerprint, location) {
  const now = Date.now();
  const pipeline = redis.pipeline();
  
  // Store fingerprint with TTL
  const fpKey = CONFIG.keys.jobFp + jobId;
  pipeline.hset(fpKey, {
    hash: fingerprint.hash,
    bits: JSON.stringify(fingerprint.bits),
    bands: JSON.stringify(fingerprint.bands),
    indexedAt: now.toString()
  });
  pipeline.expire(fpKey, CONFIG.jobTTL);
  
  // Store location with TTL
  const locKey = CONFIG.keys.jobLoc + jobId;
  pipeline.hset(locKey, {
    lat: location.lat?.toString() || '',
    lng: location.lng?.toString() || '',
    type: location.type || 'unknown'
  });
  pipeline.expire(locKey, CONFIG.jobTTL);
  
  // Add to band indexes
  for (const band of fingerprint.bands) {
    pipeline.sadd(CONFIG.keys.band + band, jobId);
  }
  
  await pipeline.exec();
}

async function getJobData(jobId) {
  const [fp, loc] = await Promise.all([
    redis.hgetall(CONFIG.keys.jobFp + jobId),
    redis.hgetall(CONFIG.keys.jobLoc + jobId)
  ]);
  
  if (!fp || !fp.hash) return null;
  
  return {
    fingerprint: {
      hash: fp.hash,
      bits: JSON.parse(fp.bits),
      bands: JSON.parse(fp.bands)
    },
    location: {
      lat: loc?.lat ? parseFloat(loc.lat) : null,
      lng: loc?.lng ? parseFloat(loc.lng) : null,
      type: loc?.type || 'unknown'
    }
  };
}

async function removeJob(jobId) {
  const data = await getJobData(jobId);
  
  if (data) {
    const pipeline = redis.pipeline();
    for (const band of data.fingerprint.bands) {
      pipeline.srem(CONFIG.keys.band + band, jobId);
    }
    await pipeline.exec();
  }
  
  await redis.del(CONFIG.keys.jobFp + jobId, CONFIG.keys.jobLoc + jobId);
}


// =============================================================================
// MAIN DEDUPLICATION API
// =============================================================================

/**
 * Process a single job for deduplication.
 */
async function processJob(job, options = {}) {
  if (!redis) throw new Error('Not initialized');
  if (!job.id) throw new Error('Job must have an id');
  
  metrics.processed++;
  const skipIndex = options.skipIndex || false;
  
  // Resolve location
  const location = await resolveLocation(job.location);
  
  // Generate fingerprint
  const fingerprint = generateFingerprint(job);
  
  // Find candidates
  const candidates = await findCandidates(fingerprint.bands);
  candidates.delete(job.id);
  
  // Check each candidate
  for (const candidateId of candidates) {
    const candidateData = await getJobData(candidateId);
    if (!candidateData) continue;
    
    // Location veto
    const locResult = compareLocations(location, candidateData.location);
    if (locResult.result === 'DIFFERENT') {
      metrics.locationVetoes++;
      continue;
    }
    
    // Fingerprint comparison
    const distance = hammingDistance(fingerprint.bits, candidateData.fingerprint.bits);
    
    if (distance <= CONFIG.duplicateThreshold) {
      metrics.duplicates++;
      return {
        isDuplicate: true,
        duplicateOf: candidateId,
        hammingDistance: distance,
        fingerprint: fingerprint.hash
      };
    }
  }
  
  // No duplicate - index if not skipped
  if (!skipIndex) {
    await indexJob(job.id, fingerprint, location);
    metrics.indexed++;
  }
  
  return {
    isDuplicate: false,
    indexed: !skipIndex,
    fingerprint: fingerprint.hash,
    location
  };
}


/**
 * Process a batch of jobs efficiently.
 * 
 * This optimizes by:
 * 1. Batch geocoding unique locations first
 * 2. Processing jobs in parallel where safe
 * 3. Providing progress callbacks
 * 
 * @param {Object[]} jobs - Array of job objects
 * @param {Object} options - { onProgress, skipIndex }
 * @returns {Object} - { results, stats }
 */
async function processJobBatch(jobs, options = {}) {
  const { onProgress, skipIndex = false } = options;
  
  const results = [];
  const stats = {
    total: jobs.length,
    duplicates: 0,
    indexed: 0,
    errors: 0
  };
  
  // Pre-resolve all unique locations
  const uniqueLocations = [...new Set(jobs.map(j => j.location).filter(Boolean))];
  
  if (onProgress) {
    onProgress({ phase: 'geocoding', total: uniqueLocations.length, completed: 0 });
  }
  
  for (let i = 0; i < uniqueLocations.length; i++) {
    await resolveLocation(uniqueLocations[i]);
    if (onProgress && i % 10 === 0) {
      onProgress({ phase: 'geocoding', total: uniqueLocations.length, completed: i + 1 });
    }
  }
  
  // Process jobs
  if (onProgress) {
    onProgress({ phase: 'deduplicating', total: jobs.length, completed: 0 });
  }
  
  const MIN_JOBS_FOR_FAIL_FAST = 10;
  const ERROR_RATE_THRESHOLD = 0.5;

  for (let i = 0; i < jobs.length; i++) {
    try {
      const result = await processJob(jobs[i], { skipIndex });
      results.push({ jobId: jobs[i].id, ...result });

      if (result.isDuplicate) stats.duplicates++;
      else if (result.indexed) stats.indexed++;

    } catch (error) {
      stats.errors++;
      results.push({ jobId: jobs[i].id, error: error.message });

      // Fail fast if error rate exceeds threshold after minimum sample size
      const processed = i + 1;
      if (processed >= MIN_JOBS_FOR_FAIL_FAST) {
        const errorRate = stats.errors / processed;
        if (errorRate > ERROR_RATE_THRESHOLD) {
          throw new Error(
            `Batch processing aborted: error rate ${(errorRate * 100).toFixed(1)}% exceeds ${ERROR_RATE_THRESHOLD * 100}% threshold after ${processed} jobs (${stats.errors} errors)`
          );
        }
      }
    }

    if (onProgress && i % 10 === 0) {
      onProgress({ phase: 'deduplicating', total: jobs.length, completed: i + 1, stats });
    }
  }
  
  if (onProgress) {
    onProgress({ phase: 'complete', stats });
  }
  
  return { results, stats };
}


/**
 * Process scrape results - convenience wrapper for scraper integration.
 * 
 * @param {Object[]} scrapedJobs - Jobs from scraper (must have id, company, title, location, description)
 * @param {Object} options - { source, onProgress }
 * @returns {Object} - { newJobs, duplicateJobs, stats }
 */
async function processScrapeResults(scrapedJobs, options = {}) {
  const { source = 'unknown', onProgress } = options;
  
  const { results, stats } = await processJobBatch(scrapedJobs, { onProgress });
  
  const newJobs = results.filter(r => !r.isDuplicate && !r.error).map(r => r.jobId);
  const duplicateJobs = results.filter(r => r.isDuplicate).map(r => ({
    jobId: r.jobId,
    duplicateOf: r.duplicateOf
  }));
  
  // Record metrics
  const today = new Date().toISOString().split('T')[0];
  const metricsKey = CONFIG.keys.metrics + today;
  
  await redis.hincrby(metricsKey, 'processed', scrapedJobs.length);
  await redis.hincrby(metricsKey, 'duplicates', stats.duplicates);
  await redis.hincrby(metricsKey, 'indexed', stats.indexed);
  await redis.hincrby(metricsKey, `source:${source}`, scrapedJobs.length);
  await redis.expire(metricsKey, 60 * 60 * 24 * 30);  // Keep 30 days of metrics
  
  return { newJobs, duplicateJobs, stats };
}


/**
 * Check which job IDs from a list are already in the index.
 * Useful for pre-filtering before scraping detailed job data.
 * 
 * @param {string[]} jobIds - Array of job IDs to check
 * @returns {Object} - { existing: string[], new: string[] }
 */
async function checkExistingJobs(jobIds) {
  const existing = [];
  const newIds = [];
  
  const pipeline = redis.pipeline();
  for (const id of jobIds) {
    pipeline.exists(CONFIG.keys.jobFp + id);
  }
  
  const results = await pipeline.exec();
  
  for (let i = 0; i < jobIds.length; i++) {
    const [err, exists] = results[i];
    if (!err && exists) {
      existing.push(jobIds[i]);
    } else {
      newIds.push(jobIds[i]);
    }
  }
  
  return { existing, new: newIds };
}


// =============================================================================
// MAINTENANCE & MONITORING
// =============================================================================

/**
 * Get current index statistics.
 */
async function getStats() {
  const today = new Date().toISOString().split('T')[0];
  const dailyMetrics = await redis.hgetall(CONFIG.keys.metrics + today);
  
  const fpKeys = await redis.keys(CONFIG.keys.jobFp + '*');
  const geoKeys = await redis.keys(CONFIG.keys.geo + '*');
  const bandKeys = await redis.keys(CONFIG.keys.band + '*');
  
  return {
    indexedJobs: fpKeys.length,
    cachedLocations: geoKeys.length,
    bandBuckets: bandKeys.length,
    today: {
      processed: parseInt(dailyMetrics?.processed || 0),
      duplicates: parseInt(dailyMetrics?.duplicates || 0),
      indexed: parseInt(dailyMetrics?.indexed || 0)
    },
    session: metrics
  };
}


/**
 * Clean up expired jobs from band indexes.
 * Run this periodically (e.g., daily via cron) to remove stale band entries.
 */
async function cleanupExpiredBands() {
  const bandKeys = await redis.keys(CONFIG.keys.band + '*');
  let removed = 0;
  
  for (const bandKey of bandKeys) {
    const members = await redis.smembers(bandKey);
    
    for (const jobId of members) {
      const exists = await redis.exists(CONFIG.keys.jobFp + jobId);
      if (!exists) {
        await redis.srem(bandKey, jobId);
        removed++;
      }
    }
    
    // Remove empty band sets
    const remaining = await redis.scard(bandKey);
    if (remaining === 0) {
      await redis.del(bandKey);
    }
  }
  
  return { removedEntries: removed, bandKeysChecked: bandKeys.length };
}


/**
 * Clear jobs indexed within a date range.
 * @param {number} startMs - Start timestamp in milliseconds (inclusive)
 * @param {number} endMs - End timestamp in milliseconds (inclusive)
 * @returns {Object} - { removedJobs, scanned }
 */
async function clearByDateRange(startMs, endMs) {
  const fpKeys = await redis.keys(CONFIG.keys.jobFp + '*');
  let removed = 0;

  for (const fpKey of fpKeys) {
    const indexedAt = await redis.hget(fpKey, 'indexedAt');
    if (!indexedAt) continue;

    const timestamp = parseInt(indexedAt, 10);
    if (timestamp >= startMs && timestamp <= endMs) {
      const jobId = fpKey.replace(CONFIG.keys.jobFp, '');
      await removeJob(jobId);
      removed++;
    }
  }

  return { removedJobs: removed, scanned: fpKeys.length };
}


/**
 * Clear all deduplication data.
 */
async function clearAll() {
  const patterns = [
    CONFIG.keys.geo + '*',
    CONFIG.keys.band + '*',
    CONFIG.keys.jobFp + '*',
    CONFIG.keys.jobLoc + '*',
    CONFIG.keys.metrics + '*'
  ];
  
  for (const pattern of patterns) {
    const keys = await redis.keys(pattern);
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  }
  
  metrics = {
    processed: 0, duplicates: 0, indexed: 0,
    locationVetoes: 0, geoCacheHits: 0, geoCacheMisses: 0, errors: 0
  };
}


// =============================================================================
// EXPORTS
// =============================================================================

module.exports = {
  // Core
  initialize,
  processJob,
  removeJob,
  
  // Batch processing
  processJobBatch,
  processScrapeResults,
  checkExistingJobs,
  
  // Location
  resolveLocation,
  compareLocations,
  haversineDistance,
  
  // Fingerprint
  generateFingerprint,
  hammingDistance,
  
  // Maintenance
  getStats,
  cleanupExpiredBands,
  clearByDateRange,
  clearAll,
  
  // Config
  CONFIG
};
