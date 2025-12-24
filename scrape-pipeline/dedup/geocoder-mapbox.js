/**
 * MAPBOX GEOCODER WITH RATE LIMITING
 * ===================================
 * 
 * This module provides geocoding via the Mapbox API with:
 * - Automatic rate limiting (respects Mapbox's limits)
 * - Daily request cap (configurable, for cost control)
 * - Request queuing (prevents burst overload)
 * 
 * USAGE:
 * 
 *   const geocoder = require('./geocoder-mapbox');
 *   
 *   geocoder.initialize({
 *     apiKey: process.env.MAPBOX_API_KEY,
 *     dailyLimit: 500,  // Optional: max requests per day
 *   });
 *   
 *   const result = await geocoder.geocode('Austin, TX');
 *   // { lat: 30.2672, lng: -97.7431, confidence: 'high', source: 'mapbox' }
 * 
 * RATE LIMITING:
 * 
 *   Mapbox free tier allows 100,000 requests/month (~3,300/day).
 *   We default to a conservative 1,000/day limit and 10 req/sec rate.
 *   Adjust based on your plan.
 */

// =============================================================================
// CONFIGURATION
// =============================================================================

const CONFIG = {
  apiKey: null,
  
  // Rate limiting
  requestsPerSecond: 10,      // Max requests per second
  dailyLimit: 1000,           // Max requests per day (0 = unlimited)
  
  // Request tracking
  requestsToday: 0,
  lastRequestTime: 0,
  currentDay: null,
  
  // API settings
  baseUrl: 'https://api.mapbox.com/geocoding/v5/mapbox.places',
  timeout: 5000,  // 5 second timeout
};


// =============================================================================
// INITIALIZATION
// =============================================================================

/**
 * Initialize the geocoder with your Mapbox API key.
 * 
 * @param {Object} options
 * @param {string} options.apiKey - Mapbox API key (required)
 * @param {number} options.dailyLimit - Max requests per day (default: 1000)
 * @param {number} options.requestsPerSecond - Rate limit (default: 10)
 */
function initialize(options) {
  if (!options.apiKey) {
    throw new Error('Mapbox API key is required');
  }
  
  CONFIG.apiKey = options.apiKey;
  
  if (options.dailyLimit !== undefined) {
    CONFIG.dailyLimit = options.dailyLimit;
  }
  
  if (options.requestsPerSecond !== undefined) {
    CONFIG.requestsPerSecond = options.requestsPerSecond;
  }
  
  // Reset daily counter
  CONFIG.currentDay = getDateString();
  CONFIG.requestsToday = 0;
  
  console.log(`[Geocoder] Initialized with daily limit: ${CONFIG.dailyLimit}, rate: ${CONFIG.requestsPerSecond}/sec`);
}


// =============================================================================
// RATE LIMITING
// =============================================================================

/**
 * Get current date as YYYY-MM-DD string.
 */
function getDateString() {
  return new Date().toISOString().split('T')[0];
}


/**
 * Check if we've exceeded the daily limit.
 */
function isDailyLimitReached() {
  // Reset counter if it's a new day
  const today = getDateString();
  if (today !== CONFIG.currentDay) {
    CONFIG.currentDay = today;
    CONFIG.requestsToday = 0;
  }
  
  if (CONFIG.dailyLimit === 0) {
    return false;  // No limit
  }
  
  return CONFIG.requestsToday >= CONFIG.dailyLimit;
}


/**
 * Wait for rate limit window if needed.
 */
async function waitForRateLimit() {
  const minInterval = 1000 / CONFIG.requestsPerSecond;
  const timeSinceLastRequest = Date.now() - CONFIG.lastRequestTime;
  
  if (timeSinceLastRequest < minInterval) {
    const waitTime = minInterval - timeSinceLastRequest;
    await new Promise(resolve => setTimeout(resolve, waitTime));
  }
  
  CONFIG.lastRequestTime = Date.now();
}


/**
 * Increment the daily request counter.
 */
function incrementCounter() {
  CONFIG.requestsToday++;
}


// =============================================================================
// GEOCODING
// =============================================================================

/**
 * Geocode a location string to coordinates.
 * 
 * @param {string} location - Location string (e.g., "Austin, TX")
 * @returns {Object|null} - { lat, lng, confidence, source, raw } or null if not found
 */
async function geocode(location) {
  if (!CONFIG.apiKey) {
    throw new Error('Geocoder not initialized. Call initialize() first.');
  }
  
  if (!location || location.trim() === '') {
    return null;
  }
  
  // Check daily limit
  if (isDailyLimitReached()) {
    console.warn(`[Geocoder] Daily limit reached (${CONFIG.dailyLimit})`);
    return { lat: null, lng: null, error: 'daily_limit_reached' };
  }
  
  // Rate limit
  await waitForRateLimit();
  
  try {
    const encoded = encodeURIComponent(location.trim());
    const url = `${CONFIG.baseUrl}/${encoded}.json?access_token=${CONFIG.apiKey}&limit=1&types=place,locality,address,poi`;
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), CONFIG.timeout);
    
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);
    
    incrementCounter();
    
    if (!response.ok) {
      console.error(`[Geocoder] API error: ${response.status} ${response.statusText}`);
      return null;
    }
    
    const data = await response.json();
    
    if (!data.features || data.features.length === 0) {
      // Location not found
      return { lat: null, lng: null, notFound: true };
    }
    
    const feature = data.features[0];
    const [lng, lat] = feature.center;
    
    // Determine confidence based on relevance score and match type
    let confidence = 'medium';
    if (feature.relevance >= 0.9) {
      confidence = 'high';
    } else if (feature.relevance < 0.5) {
      confidence = 'low';
    }
    
    return {
      lat,
      lng,
      confidence,
      source: 'mapbox',
      placeName: feature.place_name,
      placeType: feature.place_type?.[0],
      relevance: feature.relevance,
      raw: feature  // Full response for debugging
    };
    
  } catch (error) {
    if (error.name === 'AbortError') {
      console.error('[Geocoder] Request timeout');
    } else {
      console.error('[Geocoder] Error:', error.message);
    }
    return null;
  }
}


/**
 * Batch geocode multiple locations.
 * Processes sequentially to respect rate limits.
 * 
 * @param {string[]} locations - Array of location strings
 * @returns {Map<string, Object>} - Map of location -> result
 */
async function batchGeocode(locations) {
  const results = new Map();
  
  for (const location of locations) {
    if (!results.has(location)) {
      const result = await geocode(location);
      results.set(location, result);
    }
  }
  
  return results;
}


/**
 * Get current usage stats.
 */
function getStats() {
  return {
    requestsToday: CONFIG.requestsToday,
    dailyLimit: CONFIG.dailyLimit,
    remainingToday: CONFIG.dailyLimit > 0 
      ? Math.max(0, CONFIG.dailyLimit - CONFIG.requestsToday) 
      : 'unlimited',
    currentDay: CONFIG.currentDay
  };
}


// =============================================================================
// EXPORTS
// =============================================================================

module.exports = {
  initialize,
  geocode,
  batchGeocode,
  getStats,
  isDailyLimitReached
};
