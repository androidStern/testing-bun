/**
 * South Florida Transit Accessibility Scorer
 * 
 * Downloads GTFS feeds from South Florida transit agencies, extracts stop locations,
 * and scores jobs based on proximity to transit stops.
 * 
 * Run with: bun run transit-scorer.ts
 * 
 * Scoring:
 *   A+ : Within 0.25mi of rail station (Metrorail, Tri-Rail, Brightline)
 *   A  : Within 0.25mi of any transit stop
 *   B  : Within 0.5mi of any transit stop
 *   C  : Within 1mi of any transit stop  
 *   D  : Beyond 1mi from nearest transit
 */

import * as fs from 'fs';
import * as path from 'path';
import * as AdmZip from 'adm-zip';

// Simple CSV parser (GTFS files are well-formed, don't need full parser)
function parseCSV(content: string): Record<string, string>[] {
  const lines = content.split('\n').filter(line => line.trim());
  if (lines.length === 0) return [];
  
  const headers = parseCSVLine(lines[0]);
  const records: Record<string, string>[] = [];
  
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    const record: Record<string, string> = {};
    for (let j = 0; j < headers.length; j++) {
      record[headers[j]] = values[j] || '';
    }
    records.push(record);
  }
  
  return records;
}

function parseCSVLine(line: string): string[] {
  const values: string[] = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      values.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  
  values.push(current.trim());
  return values;
}

// ============================================================================
// Types
// ============================================================================

interface TransitStop {
  stopId: string;
  stopName: string;
  lat: number;
  lng: number;
  locationType: number; // 0=stop, 1=station
  isRail: boolean;
  agency: string;
}

export interface TransitScore {
  score: 'A+' | 'A' | 'B' | 'C' | 'D';
  nearestStop: TransitStop | null;
  distanceMiles: number;
  nearbyStops: number; // within 0.5mi
  nearbyRail: boolean;
  details: string;
}

interface JobLocation {
  id: string;
  lat: number;
  lng: number;
  [key: string]: any;
}

// ============================================================================
// GTFS Feed Configuration
// ============================================================================

// South Florida transit agency GTFS feeds
// These URLs are from Transitland and transit agency websites
const GTFS_FEEDS = [
  {
    name: 'Miami-Dade Transit',
    shortName: 'MDT',
    // Direct URL from Miami-Dade county
    url: 'https://www.miamidade.gov/transit/googletransit/current/google_transit.zip',
    railRouteTypes: [1, 2], // Subway, Commuter Rail
    railRouteIds: ['MIA', 'MOM'], // Metrorail, Metromover prefixes
  },
  {
    name: 'Broward County Transit',
    shortName: 'BCT',
    url: 'https://www.broward.org/bct/documents/google_transit.zip',
    railRouteTypes: [],
    railRouteIds: [],
  },
  {
    name: 'Palm Tran',
    shortName: 'PT',
    url: 'http://www.palmtran.org/feed/google_transit.zip',
    railRouteTypes: [],
    railRouteIds: [],
  },
  {
    name: 'Tri-Rail (SFRTA)',
    shortName: 'TRI',
    url: 'https://gtfs.tri-rail.com/gtfs.zip',
    railRouteTypes: [2], // Commuter rail
    railRouteIds: ['TRI'],
  },
  {
    name: 'Brightline',
    shortName: 'BL',
    url: 'http://feed.gobrightline.com/bl_gtfs.zip',
    railRouteTypes: [2],
    railRouteIds: [],
  },
];

// ============================================================================
// Haversine Distance Calculation
// ============================================================================

const EARTH_RADIUS_MILES = 3958.8;

function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (deg: number) => deg * (Math.PI / 180);
  
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  
  const a = Math.sin(dLat / 2) ** 2 +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
            Math.sin(dLng / 2) ** 2;
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  
  return EARTH_RADIUS_MILES * c;
}

// ============================================================================
// GTFS Download & Parsing
// ============================================================================

const DATA_DIR = '../data/gtfs';

async function downloadGTFS(feed: typeof GTFS_FEEDS[0]): Promise<string | null> {
  const zipPath = path.join(DATA_DIR, `${feed.shortName}.zip`);
  const extractDir = path.join(DATA_DIR, feed.shortName);
  
  // Check if we already have recent data (less than 7 days old)
  if (fs.existsSync(extractDir)) {
    const stats = fs.statSync(extractDir);
    const ageMs = Date.now() - stats.mtimeMs;
    const ageDays = ageMs / (1000 * 60 * 60 * 24);
    
    if (ageDays < 7) {
      console.log(`   ✓ Using cached ${feed.shortName} (${ageDays.toFixed(1)} days old)`);
      return extractDir;
    }
  }
  
  console.log(`   📥 Downloading ${feed.name}...`);
  
  try {
    const response = await fetch(feed.url, {
      headers: {
        'User-Agent': 'RecoveryJobs-TransitScorer/1.0',
      },
    });
    
    if (!response.ok) {
      console.log(`   ⚠️ Failed to download ${feed.shortName}: ${response.status}`);
      return null;
    }
    
    const buffer = await response.arrayBuffer();
    fs.writeFileSync(zipPath, Buffer.from(buffer));
    
    // Extract ZIP
    console.log(`   📦 Extracting ${feed.shortName}...`);
    
    // Create extract directory
    if (!fs.existsSync(extractDir)) {
      fs.mkdirSync(extractDir, { recursive: true });
    }
    
    // Extract using adm-zip (no system dependency)
    const zip = new AdmZip.default(zipPath);
    zip.extractAllTo(extractDir, true);
    
    console.log(`   ✓ ${feed.name} ready`);
    return extractDir;
    
  } catch (error) {
    console.log(`   ⚠️ Error with ${feed.shortName}: ${error}`);
    return null;
  }
}

function parseStops(extractDir: string, feed: typeof GTFS_FEEDS[0]): TransitStop[] {
  const stopsFile = path.join(extractDir, 'stops.txt');
  
  if (!fs.existsSync(stopsFile)) {
    // Check for nested directory (some GTFS feeds have this)
    const entries = fs.readdirSync(extractDir);
    for (const entry of entries) {
      const nestedPath = path.join(extractDir, entry, 'stops.txt');
      if (fs.existsSync(nestedPath)) {
        return parseStopsFile(nestedPath, feed);
      }
    }
    console.log(`   ⚠️ No stops.txt found in ${feed.shortName}`);
    return [];
  }
  
  return parseStopsFile(stopsFile, feed);
}

function parseStopsFile(stopsFile: string, feed: typeof GTFS_FEEDS[0]): TransitStop[] {
  const content = fs.readFileSync(stopsFile, 'utf-8');
  const records = parseCSV(content);
  
  const stops: TransitStop[] = [];
  
  // Also check routes.txt to identify rail routes
  const routesFile = stopsFile.replace('stops.txt', 'routes.txt');
  const railRouteIds = new Set<string>(feed.railRouteIds);
  
  if (fs.existsSync(routesFile)) {
    const routesContent = fs.readFileSync(routesFile, 'utf-8');
    const routes = parseCSV(routesContent);
    
    for (const route of routes) {
      const routeType = parseInt(route.route_type, 10);
      if (feed.railRouteTypes.includes(routeType)) {
        railRouteIds.add(route.route_id);
      }
    }
  }
  
  // Check stop_times.txt to see which stops are served by rail routes
  const railStopIds = new Set<string>();
  const stopTimesFile = stopsFile.replace('stops.txt', 'stop_times.txt');
  const tripsFile = stopsFile.replace('stops.txt', 'trips.txt');
  
  if (fs.existsSync(tripsFile) && fs.existsSync(stopTimesFile) && railRouteIds.size > 0) {
    // Build trip -> route mapping
    const tripsContent = fs.readFileSync(tripsFile, 'utf-8');
    const trips = parseCSV(tripsContent);
    
    const tripRouteMap = new Map<string, string>();
    for (const trip of trips) {
      tripRouteMap.set(trip.trip_id, trip.route_id);
    }
    
    // Find stops used by rail trips
    const stopTimesContent = fs.readFileSync(stopTimesFile, 'utf-8');
    const stopTimes = parseCSV(stopTimesContent);
    
    for (const st of stopTimes) {
      const routeId = tripRouteMap.get(st.trip_id);
      if (routeId && railRouteIds.has(routeId)) {
        railStopIds.add(st.stop_id);
      }
    }
  }
  
  for (const record of records) {
    const lat = parseFloat(record.stop_lat);
    const lng = parseFloat(record.stop_lon);
    
    if (isNaN(lat) || isNaN(lng)) continue;
    
    // Filter to South Florida bounding box
    // Roughly: Miami-Dade, Broward, Palm Beach counties
    // Lat: 25.0 to 27.0, Lng: -80.9 to -79.9
    if (lat < 24.5 || lat > 27.5 || lng < -81.5 || lng > -79.5) continue;
    
    const locationType = parseInt(record.location_type || '0', 10);
    const isRail = railStopIds.has(record.stop_id) || 
                   locationType === 1 || // Station
                   (feed.shortName === 'TRI') || // All Tri-Rail stops are rail
                   (feed.shortName === 'BL'); // All Brightline stops are rail
    
    stops.push({
      stopId: record.stop_id,
      stopName: record.stop_name || 'Unknown',
      lat,
      lng,
      locationType,
      isRail,
      agency: feed.shortName,
    });
  }
  
  return stops;
}

// ============================================================================
// Transit Scoring
// ============================================================================

function scoreLocation(lat: number, lng: number, stops: TransitStop[]): TransitScore {
  let nearestStop: TransitStop | null = null;
  let nearestDistance = Infinity;
  let nearbyStops = 0;
  let nearbyRail = false;
  let nearestRailStop: TransitStop | null = null;
  let nearestRailDistance = Infinity;
  
  for (const stop of stops) {
    const distance = haversineDistance(lat, lng, stop.lat, stop.lng);
    
    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearestStop = stop;
    }
    
    if (distance <= 0.5) {
      nearbyStops++;
    }
    
    if (stop.isRail && distance <= 0.5) {
      nearbyRail = true;
    }
    
    if (stop.isRail && distance < nearestRailDistance) {
      nearestRailDistance = distance;
      nearestRailStop = stop;
    }
  }
  
  // Determine score
  let score: TransitScore['score'];
  let details: string;
  
  if (nearestRailDistance <= 0.25) {
    score = 'A+';
    details = `${nearestRailDistance.toFixed(2)}mi to ${nearestRailStop?.stopName} (${nearestRailStop?.agency} rail)`;
  } else if (nearestDistance <= 0.25) {
    score = 'A';
    details = `${nearestDistance.toFixed(2)}mi to ${nearestStop?.stopName} (${nearestStop?.agency})`;
  } else if (nearestDistance <= 0.5) {
    score = 'B';
    details = `${nearestDistance.toFixed(2)}mi to ${nearestStop?.stopName} (${nearestStop?.agency})`;
  } else if (nearestDistance <= 1.0) {
    score = 'C';
    details = `${nearestDistance.toFixed(2)}mi to ${nearestStop?.stopName} (${nearestStop?.agency})`;
  } else {
    score = 'D';
    details = nearestStop 
      ? `${nearestDistance.toFixed(2)}mi to nearest stop (${nearestStop.agency})`
      : 'No transit stops found nearby';
  }
  
  return {
    score,
    nearestStop,
    distanceMiles: nearestDistance,
    nearbyStops,
    nearbyRail,
    details,
  };
}

// ============================================================================
// Main API
// ============================================================================

let cachedStops: TransitStop[] | null = null;

export async function loadTransitData(): Promise<TransitStop[]> {
  if (cachedStops) return cachedStops;
  
  console.log('🚌 Loading South Florida Transit Data\n');
  
  // Create data directory
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  
  const allStops: TransitStop[] = [];
  
  for (const feed of GTFS_FEEDS) {
    const extractDir = await downloadGTFS(feed);
    if (extractDir) {
      const stops = parseStops(extractDir, feed);
      allStops.push(...stops);
      console.log(`   📍 ${feed.shortName}: ${stops.length} stops (${stops.filter(s => s.isRail).length} rail)`);
    }
  }
  
  // Deduplicate stops that are very close (within 50 feet)
  const uniqueStops: TransitStop[] = [];
  const seen = new Set<string>();
  
  for (const stop of allStops) {
    // Round to ~50 feet precision for deduplication
    const key = `${stop.lat.toFixed(4)},${stop.lng.toFixed(4)}`;
    if (!seen.has(key)) {
      seen.add(key);
      uniqueStops.push(stop);
    }
  }
  
  console.log(`\n✅ Loaded ${uniqueStops.length} unique transit stops`);
  console.log(`   🚇 ${uniqueStops.filter(s => s.isRail).length} rail stations\n`);
  
  cachedStops = uniqueStops;
  return uniqueStops;
}

export async function scoreTransitAccess(lat: number, lng: number): Promise<TransitScore> {
  const stops = await loadTransitData();
  return scoreLocation(lat, lng, stops);
}

export async function scoreJobs<T extends JobLocation>(jobs: T[]): Promise<(T & { transit: TransitScore })[]> {
  const stops = await loadTransitData();
  
  console.log(`📊 Scoring ${jobs.length} job locations...\n`);
  
  const scored = jobs.map((job, i) => {
    const transit = scoreLocation(job.lat, job.lng, stops);
    
    if ((i + 1) % 50 === 0 || i === jobs.length - 1) {
      console.log(`   Scored ${i + 1}/${jobs.length}`);
    }
    
    return { ...job, transit };
  });
  
  // Summary stats
  const grades = { 'A+': 0, 'A': 0, 'B': 0, 'C': 0, 'D': 0 };
  for (const job of scored) {
    grades[job.transit.score]++;
  }
  
  console.log('\n📈 Transit Score Distribution:');
  console.log(`   A+ (Rail < 0.25mi): ${grades['A+']} (${(grades['A+'] / jobs.length * 100).toFixed(1)}%)`);
  console.log(`   A  (Stop < 0.25mi): ${grades['A']} (${(grades['A'] / jobs.length * 100).toFixed(1)}%)`);
  console.log(`   B  (Stop < 0.5mi):  ${grades['B']} (${(grades['B'] / jobs.length * 100).toFixed(1)}%)`);
  console.log(`   C  (Stop < 1mi):    ${grades['C']} (${(grades['C'] / jobs.length * 100).toFixed(1)}%)`);
  console.log(`   D  (Stop > 1mi):    ${grades['D']} (${(grades['D'] / jobs.length * 100).toFixed(1)}%)`);
  
  return scored;
}

// ============================================================================
// CLI Demo
// ============================================================================

async function main() {
  console.log('═'.repeat(60));
  console.log('South Florida Transit Accessibility Scorer');
  console.log('═'.repeat(60) + '\n');
  
  // Load transit data
  await loadTransitData();
  
  // Demo: Score some test locations
  const testLocations = [
    { name: 'Downtown Miami (Brickell)', lat: 25.7617, lng: -80.1918 },
    { name: 'Miami Beach (South Beach)', lat: 25.7826, lng: -80.1341 },
    { name: 'Fort Lauderdale Downtown', lat: 26.1224, lng: -80.1373 },
    { name: 'West Palm Beach Downtown', lat: 26.7153, lng: -80.0534 },
    { name: 'Hialeah', lat: 25.8576, lng: -80.2781 },
    { name: 'Pembroke Pines (suburban)', lat: 26.0128, lng: -80.3413 },
    { name: 'Boca Raton', lat: 26.3683, lng: -80.1289 },
    { name: 'Homestead', lat: 25.4687, lng: -80.4776 },
  ];
  
  console.log('\n📍 Test Location Scores:\n');
  console.log('─'.repeat(60));
  
  for (const loc of testLocations) {
    const score = await scoreTransitAccess(loc.lat, loc.lng);
    console.log(`${loc.name}`);
    console.log(`   Score: ${score.score} | ${score.details}`);
    console.log(`   Nearby stops (0.5mi): ${score.nearbyStops} | Rail nearby: ${score.nearbyRail ? 'Yes' : 'No'}`);
    console.log('');
  }
  
  // Save stops to JSON for inspection
  const stops = await loadTransitData();
  fs.writeFileSync(path.join(DATA_DIR, 'all-stops.json'), JSON.stringify(stops, null, 2));
  console.log(`\n💾 Saved ${stops.length} stops to ${DATA_DIR}/all-stops.json`);
}

// Run if main module
const isMain = require.main === module || process.argv[1]?.includes('transit-scorer');
if (isMain) {
  main().catch(console.error);
}
