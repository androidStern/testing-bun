/**
 * Florida Fair Chance Employers Scraper
 *
 * Scrapes Indeed for Florida jobs with "Fair Chance" filter (Q5R8A)
 * to build a list of employers who actively hire people with criminal records.
 *
 * Run with: bun run scrape-pipeline/fair-chance-employers.ts
 *
 * Uses FlareSolverr to bypass Cloudflare protection.
 * Requires: docker run -d --name=flaresolverr -p 8191:8191 ghcr.io/flaresolverr/flaresolverr:latest
 */

import * as fs from "fs";
import * as path from "path";
import { getRedis } from "./lib/redis";
import { normalize, normalizedKey } from "./company-matching/normalize";

const FLARESOLVERR_URL =
	process.env.FLARESOLVERR_URL || "http://localhost:8191/v1";

const DATA_DIR = path.join(__dirname, "../data/fair-chance");

// Current active session ID (managed by session lifecycle functions)
let currentSessionId: string | null = null;

// How often to kill FlareSolverr sessions to prevent stale browsers
const PAGES_BEFORE_SESSION_RESET = 25;

// Scraping limits
const DEFAULT_MAX_PAGES = 150; // Data plateaus around this point
const CONSECUTIVE_NO_NEW_EMPLOYERS_LIMIT = 20; // Stop if no new employers found

// Redis configuration
const REDIS_KEY_PREFIX = "fairchance:employer:";
const FAIR_CHANCE_TTL = 60 * 60 * 24 * 90; // 90 days

// ============================================================================
// Types
// ============================================================================

export interface FairChanceEmployer {
	fccid: string; // Indeed company ID
	name: string;
	slug: string; // URL-friendly name
	jobCount: number; // Number of fair chance jobs seen
	locations: string[]; // Cities/locations where they hire
	jobTitles: string[]; // Sample job titles
	firstSeen: string;
	lastSeen: string;
	indeedUrl: string;
}

interface JobCard {
	jobKey: string;
	title: string;
	company: string;
	companySlug: string;
	fccid: string;
	location: string;
}

interface FlareSolverrResponse {
	status: string;
	message: string;
	solution: {
		url: string;
		status: number;
		cookies: Array<{ name: string; value: string; domain: string }>;
		userAgent: string;
		response: string;
	};
}

export interface FairChanceStats {
	totalEmployers: number;
	oldestLastSeen: string | null;
	newestLastSeen: string | null;
	employersSeenToday: number;
	employersStale30Days: number;
	employersStale60Days: number;
}

export interface ScrapeResult {
	employers: FairChanceEmployer[];
	stats: {
		pagesScraped: number;
		jobsSeen: number;
		newEmployers: number;
		existingEmployersTouched: number;
		earlyExitReason?: string;
	};
}

// ============================================================================
// FlareSolverr Client with Session Management
// ============================================================================

/**
 * Create a new FlareSolverr session.
 * Sessions persist browser state (cookies, challenge solutions) across requests.
 */
async function createFlareSolverrSession(): Promise<string> {
	const sessionId = `fairchance-${Date.now()}`;

	const res = await fetch(FLARESOLVERR_URL, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({
			cmd: "sessions.create",
			session: sessionId,
		}),
	});

	const data = await res.json() as { status: string; message: string; session?: string };

	if (data.status !== "ok") {
		throw new Error(`Failed to create FlareSolverr session: ${data.message}`);
	}

	currentSessionId = sessionId;
	console.log(`   🔧 Created FlareSolverr session: ${sessionId}`);
	return sessionId;
}

/**
 * Kill all FlareSolverr sessions and create a fresh one.
 * This prevents rate limiting and stale browser state.
 */
async function resetFlareSolverrSession(): Promise<string> {
	try {
		// List all sessions
		const listRes = await fetch(FLARESOLVERR_URL, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ cmd: "sessions.list" }),
		});
		const listData = await listRes.json() as { sessions?: string[] };

		// Kill each session
		for (const session of listData.sessions || []) {
			await fetch(FLARESOLVERR_URL, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ cmd: "sessions.destroy", session }),
			});
		}
		console.log(`   🔄 Killed ${listData.sessions?.length || 0} FlareSolverr sessions`);
	} catch (e) {
		// Ignore errors - sessions might not exist
	}

	// Create a fresh session
	return createFlareSolverrSession();
}

/**
 * Destroy the current session (cleanup on completion).
 */
async function destroyCurrentSession(): Promise<void> {
	if (!currentSessionId) return;

	try {
		await fetch(FLARESOLVERR_URL, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				cmd: "sessions.destroy",
				session: currentSessionId,
			}),
		});
		console.log(`   🧹 Destroyed session: ${currentSessionId}`);
	} catch (e) {
		// Ignore cleanup errors
	}
	currentSessionId = null;
}

async function fetchViaFlareSolverr(url: string): Promise<string> {
	console.log(`   🌐 Fetching: ${url.substring(0, 80)}...`);

	if (!currentSessionId) {
		throw new Error("No active FlareSolverr session. Call createFlareSolverrSession first.");
	}

	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), 120000); // 2 min outer timeout

	try {
		const response = await fetch(FLARESOLVERR_URL, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				cmd: "request.get",
				url,
				session: currentSessionId, // Use persistent session for cookie/challenge reuse
				maxTimeout: 90000, // 90s for Cloudflare challenges (they can take 60-75s)
			}),
			signal: controller.signal,
		});

		const data = (await response.json()) as FlareSolverrResponse;

		if (data.status !== "ok") {
			throw new Error(`FlareSolverr error: ${data.message}`);
		}

		if (data.solution.status !== 200) {
			throw new Error(`Request failed: ${data.solution.status}`);
		}

		return data.solution.response;
	} finally {
		clearTimeout(timeout);
	}
}

// ============================================================================
// HTML Parsing
// ============================================================================

function parseJobCards(html: string): JobCard[] {
	const cards: JobCard[] = [];

	// Extract job keys
	const jobKeyMatches = [...html.matchAll(/data-jk="([a-f0-9]+)"/g)];
	const jobKeys = jobKeyMatches.map((m) => m[1]);

	// Extract company names
	const companyMatches = [
		...html.matchAll(/data-testid="company-name"[^>]*>([^<]+)<\/span>/g),
	];
	const companies = companyMatches.map((m) =>
		m[1].replace(/&amp;/g, "&").replace(/&#39;/g, "'").trim()
	);

	// Extract locations
	const locationMatches = [
		...html.matchAll(/data-testid="text-location"[^>]*>([^<]+)<\/div>/g),
	];
	const locations = locationMatches.map((m) =>
		m[1].replace(/&amp;/g, "&").trim()
	);

	// Extract FCCIDs and company slugs from job links
	// Note: URLs in HTML have & encoded as &amp;
	const fccidMap = new Map<string, string>();
	const slugMap = new Map<string, string>();

	// Pattern: Find job key with its fccid in the href (handles &amp; encoding)
	const linkMatches = [
		...html.matchAll(
			/data-jk="([a-f0-9]+)"[^>]*href="[^"]*(?:&amp;|&)fccid=([a-f0-9]+)/g
		),
	];
	for (const m of linkMatches) {
		fccidMap.set(m[1], m[2]);
	}

	// Extract cmp (company slug) separately and associate with job keys
	const cmpMatches = [
		...html.matchAll(
			/data-jk="([a-f0-9]+)"[^>]*href="[^"]*(?:&amp;|&)cmp=([^&"]+)/g
		),
	];
	for (const m of cmpMatches) {
		const slug = decodeURIComponent(m[2].replace(/\+/g, " "));
		slugMap.set(m[1], slug);
	}

	// Extract job titles
	const titleMatches = [
		...html.matchAll(
			/id="jobTitle-([a-f0-9]+)"[^>]*>([^<]+)<\/span>/g
		),
	];
	const titleMap = new Map<string, string>();
	for (const m of titleMatches) {
		titleMap.set(m[1], m[2].replace(/&amp;/g, "&").trim());
	}

	// Build job cards
	for (let i = 0; i < jobKeys.length; i++) {
		const jobKey = jobKeys[i];
		const company = companies[i] || "Unknown";
		const location = locations[i] || "Florida";
		const fccid = fccidMap.get(jobKey) || "";
		const slug = slugMap.get(jobKey) || company.replace(/\s+/g, "-");
		const title = titleMap.get(jobKey) || "Unknown Position";

		if (fccid) {
			cards.push({
				jobKey,
				title,
				company,
				companySlug: slug,
				fccid,
				location,
			});
		}
	}

	return cards;
}

function getTotalJobCount(html: string): number {
	const match = html.match(/(\d{1,3}(?:,\d{3})*)\+?\s*jobs/i);
	if (match) {
		return parseInt(match[1].replace(/,/g, ""), 10);
	}
	return 0;
}

// ============================================================================
// Scraping Logic
// ============================================================================

const BASE_URL =
	"https://www.indeed.com/jobs?q=&l=Florida&sc=0kf%3Aattr(Q5R8A)%3B";

export async function scrapeFairChanceEmployers(options?: {
	maxPages?: number;
	delayMs?: number;
	storeToRedis?: boolean;
	onProgress?: (msg: string) => void;
}): Promise<ScrapeResult> {
	const {
		maxPages = DEFAULT_MAX_PAGES,
		delayMs = 2000,
		storeToRedis = true,
		onProgress = console.log,
	} = options || {};

	onProgress("🔍 Starting Florida Fair Chance Employer Scrape\n");

	// Create data directory
	if (!fs.existsSync(DATA_DIR)) {
		fs.mkdirSync(DATA_DIR, { recursive: true });
	}

	// Track employers by fccid
	const employerMap = new Map<string, FairChanceEmployer>();
	const seenJobKeys = new Set<string>();
	const now = new Date().toISOString();

	// Track stats for the run
	let totalNewEmployers = 0;
	let totalExistingTouched = 0;
	let pagesScraped = 0;
	let earlyExitReason: string | undefined;

	// Create initial FlareSolverr session (reuses browser + cookies for all requests)
	await resetFlareSolverrSession();

	try {
	// Fetch first page to get total count
	const firstPageHtml = await fetchViaFlareSolverr(`${BASE_URL}&start=0`);
	const totalJobs = getTotalJobCount(firstPageHtml);
	const estimatedPages = Math.min(Math.ceil(totalJobs / 15), maxPages);

	onProgress(`   📊 Found ${totalJobs.toLocaleString()} fair chance jobs in Florida`);
	onProgress(`   📄 Will scrape up to ${estimatedPages} pages\n`);

	// Process first page
	const firstPageCards = parseJobCards(firstPageHtml);
	const firstPageResult = await processCards(
		firstPageCards,
		employerMap,
		seenJobKeys,
		now,
		storeToRedis
	);
	totalNewEmployers += firstPageResult.newEmployers;
	totalExistingTouched += firstPageResult.existingTouched;
	pagesScraped = 1;
	onProgress(`   Page 1: ${firstPageCards.length} jobs, ${employerMap.size} unique employers`);

	// Scrape remaining pages
	let consecutiveEmpty = 0;
	let consecutiveErrors = 0;
	let consecutiveNoNewEmployers = 0;

	for (let page = 2; page <= estimatedPages; page++) {
		// Reset FlareSolverr session periodically to prevent rate limiting
		if ((page - 1) % PAGES_BEFORE_SESSION_RESET === 0) {
			await resetFlareSolverrSession();
			await new Promise((r) => setTimeout(r, 2000)); // Give it time to stabilize
		}

		// Rate limiting
		await new Promise((r) => setTimeout(r, delayMs + Math.random() * 1000));

		const start = (page - 1) * 15; // Indeed shows ~15 jobs per page

		let html: string;
		try {
			html = await fetchViaFlareSolverr(`${BASE_URL}&start=${start}`);
			consecutiveErrors = 0; // Reset error counter on success
		} catch (err) {
			consecutiveErrors++;
			const errMsg = err instanceof Error ? err.message : String(err);
			onProgress(`   ⚠️ Page ${page} failed: ${errMsg}. Retrying after session reset...`);

			// Reset session and retry once
			await resetFlareSolverrSession();
			await new Promise((r) => setTimeout(r, 3000));

			try {
				html = await fetchViaFlareSolverr(`${BASE_URL}&start=${start}`);
				consecutiveErrors = 0;
			} catch (retryErr) {
				onProgress(`   ❌ Page ${page} retry failed. Skipping.`);
				if (consecutiveErrors >= 5) {
					earlyExitReason = `Too many consecutive errors (${consecutiveErrors})`;
					onProgress(`   🛑 ${earlyExitReason}. Stopping.`);
					break;
				}
				continue;
			}
		}

		pagesScraped = page;
		const cards = parseJobCards(html);
		const employerCountBefore = employerMap.size;

		if (cards.length === 0) {
			consecutiveEmpty++;
			if (consecutiveEmpty >= 3) {
				earlyExitReason = `No more results after page ${page - 2}`;
				onProgress(`   ⚠️ ${earlyExitReason}, stopping`);
				break;
			}
		} else {
			consecutiveEmpty = 0;
			const pageResult = await processCards(cards, employerMap, seenJobKeys, now, storeToRedis);
			totalNewEmployers += pageResult.newEmployers;
			totalExistingTouched += pageResult.existingTouched;
		}

		// Track consecutive pages with no new employers
		if (employerMap.size === employerCountBefore) {
			consecutiveNoNewEmployers++;
			if (consecutiveNoNewEmployers >= CONSECUTIVE_NO_NEW_EMPLOYERS_LIMIT) {
				earlyExitReason = `No new employers in ${CONSECUTIVE_NO_NEW_EMPLOYERS_LIMIT} consecutive pages`;
				onProgress(`   ⚠️ ${earlyExitReason}, stopping early`);
				break;
			}
		} else {
			consecutiveNoNewEmployers = 0;
		}

		onProgress(
			`   Page ${page}/${estimatedPages}: ${cards.length} jobs, ${employerMap.size} unique employers, ${seenJobKeys.size} total jobs`
		);

		// Save progress periodically
		if (page % 10 === 0) {
			saveProgress(employerMap, seenJobKeys.size);
		}
	}

	// Final save
	const employers = Array.from(employerMap.values());
	saveProgress(employerMap, seenJobKeys.size);

	onProgress(`\n✅ Scrape complete!`);
	onProgress(`   📋 ${employers.length} unique fair chance employers`);
	onProgress(`   💼 ${seenJobKeys.size} total job postings`);
	onProgress(`   🆕 ${totalNewEmployers} new employers added`);
	onProgress(`   🔄 ${totalExistingTouched} existing employers touched`);

	return {
		employers,
		stats: {
			pagesScraped,
			jobsSeen: seenJobKeys.size,
			newEmployers: totalNewEmployers,
			existingEmployersTouched: totalExistingTouched,
			earlyExitReason,
		},
	};
	} finally {
		// Always clean up the FlareSolverr session
		await destroyCurrentSession();
	}
}

async function processCards(
	cards: JobCard[],
	employerMap: Map<string, FairChanceEmployer>,
	seenJobKeys: Set<string>,
	now: string,
	storeToRedis: boolean
): Promise<{ newEmployers: number; existingTouched: number }> {
	let newEmployers = 0;
	let existingTouched = 0;
	const touchedThisBatch = new Set<string>(); // Track employers already touched in this batch

	for (const card of cards) {
		if (seenJobKeys.has(card.jobKey)) continue;
		seenJobKeys.add(card.jobKey);

		let employer = employerMap.get(card.fccid);
		let isNew = false;

		if (!employer) {
			isNew = true;
			employer = {
				fccid: card.fccid,
				name: card.company,
				slug: card.companySlug,
				jobCount: 0,
				locations: [],
				jobTitles: [],
				firstSeen: now,
				lastSeen: now,
				indeedUrl: `https://www.indeed.com/cmp/${encodeURIComponent(card.companySlug)}`,
			};
			employerMap.set(card.fccid, employer);
			newEmployers++;
		}

		employer.jobCount++;
		employer.lastSeen = now;

		// Track unique locations (max 10)
		if (
			!employer.locations.includes(card.location) &&
			employer.locations.length < 10
		) {
			employer.locations.push(card.location);
		}

		// Track sample job titles (max 5)
		if (
			!employer.jobTitles.includes(card.title) &&
			employer.jobTitles.length < 5
		) {
			employer.jobTitles.push(card.title);
		}

		// Store to Redis
		if (storeToRedis) {
			if (isNew) {
				await storeFairChanceEmployer(employer);
			} else if (!touchedThisBatch.has(card.fccid)) {
				// Touch existing employer to update lastSeen (once per batch)
				const wasUpdated = await touchFairChanceEmployer(employer.name, now);
				if (wasUpdated) {
					touchedThisBatch.add(card.fccid);
					existingTouched++;
				}
			}
		}
	}

	return { newEmployers, existingTouched };
}

function saveProgress(
	employerMap: Map<string, FairChanceEmployer>,
	totalJobs: number
): void {
	const employers = Array.from(employerMap.values()).sort(
		(a, b) => b.jobCount - a.jobCount
	);

	const output = {
		scrapedAt: new Date().toISOString(),
		totalEmployers: employers.length,
		totalJobsSeen: totalJobs,
		employers,
	};

	fs.writeFileSync(
		path.join(DATA_DIR, "florida-fair-chance-employers.json"),
		JSON.stringify(output, null, 2)
	);

	// Also save a simple TSV for easy viewing
	const tsv = [
		["Name", "FCCID", "Job Count", "Locations", "Sample Titles", "Indeed URL"].join("\t"),
		...employers.map((e) =>
			[
				e.name,
				e.fccid,
				e.jobCount,
				e.locations.slice(0, 3).join("; "),
				e.jobTitles.slice(0, 3).join("; "),
				e.indeedUrl,
			].join("\t")
		),
	].join("\n");

	fs.writeFileSync(path.join(DATA_DIR, "florida-fair-chance-employers.tsv"), tsv);
}

// ============================================================================
// Data Loading (for use by other modules)
// ============================================================================

let cachedEmployers: FairChanceEmployer[] | null = null;

export function loadFairChanceEmployers(): FairChanceEmployer[] {
	if (cachedEmployers) return cachedEmployers;

	const jsonPath = path.join(DATA_DIR, "florida-fair-chance-employers.json");

	if (!fs.existsSync(jsonPath)) {
		console.log("⚠️ Fair chance employers data not found. Run the scraper first:");
		console.log("   bun run scrape-pipeline/fair-chance-employers.ts");
		return [];
	}

	const data = JSON.parse(fs.readFileSync(jsonPath, "utf-8"));
	cachedEmployers = data.employers;

	console.log(`📋 Loaded ${cachedEmployers!.length} fair chance employers`);
	return cachedEmployers!;
}

export function isKnownFairChanceEmployer(companyName: string): boolean {
	const employers = loadFairChanceEmployers();
	const normalized = companyName.toLowerCase().trim();

	return employers.some(
		(e) =>
			e.name.toLowerCase() === normalized ||
			e.slug.toLowerCase().replace(/-/g, " ") === normalized
	);
}

// ============================================================================
// Redis Storage (for fast lookups)
// ============================================================================

/**
 * Store a fair chance employer in Redis for fast lookups.
 * Key is the normalized company name.
 */
export async function storeFairChanceEmployer(
	employer: FairChanceEmployer
): Promise<void> {
	const redis = getRedis();
	const key = REDIS_KEY_PREFIX + normalizedKey(employer.name);

	await redis.hset(key, {
		name: employer.name,
		fccid: employer.fccid,
		slug: employer.slug,
		jobCount: employer.jobCount.toString(),
		indeedUrl: employer.indeedUrl,
		firstSeen: employer.firstSeen,
		lastSeen: employer.lastSeen,
	});
	await redis.expire(key, FAIR_CHANCE_TTL);
}

/**
 * Touch an existing fair chance employer to update lastSeen.
 * Returns true if the employer was found and updated, false otherwise.
 */
export async function touchFairChanceEmployer(
	companyName: string,
	lastSeenDate: string
): Promise<boolean> {
	const redis = getRedis();
	const key = REDIS_KEY_PREFIX + normalizedKey(companyName);
	const exists = await redis.exists(key);
	if (exists) {
		await redis.hset(key, { lastSeen: lastSeenDate });
		await redis.expire(key, FAIR_CHANCE_TTL); // Refresh TTL
		return true;
	}
	return false;
}

/**
 * Check if a company is a known fair chance employer (fast Redis lookup).
 * Uses normalized company name for matching.
 */
export async function isFairChanceEmployer(companyName: string): Promise<boolean> {
	const redis = getRedis();
	const key = REDIS_KEY_PREFIX + normalizedKey(companyName);
	return (await redis.exists(key)) === 1;
}

/**
 * Get fair chance employer details from Redis.
 * Returns null if not found.
 */
export async function getFairChanceEmployer(
	companyName: string
): Promise<Partial<FairChanceEmployer> | null> {
	const redis = getRedis();
	const key = REDIS_KEY_PREFIX + normalizedKey(companyName);
	const data = await redis.hgetall(key);

	if (!data || Object.keys(data).length === 0) {
		return null;
	}

	return {
		name: data.name,
		fccid: data.fccid,
		slug: data.slug,
		jobCount: parseInt(data.jobCount, 10),
		indeedUrl: data.indeedUrl,
		firstSeen: data.firstSeen,
		lastSeen: data.lastSeen,
	};
}

/**
 * Bulk load all scraped employers into Redis.
 * Useful for initial population or refresh.
 */
export async function loadFairChanceEmployersToRedis(): Promise<number> {
	const employers = loadFairChanceEmployers();
	let stored = 0;

	for (const employer of employers) {
		await storeFairChanceEmployer(employer);
		stored++;
	}

	console.log(`📋 Loaded ${stored} fair chance employers to Redis`);
	return stored;
}

/**
 * Get statistics about fair chance employers in Redis.
 * Useful for monitoring staleness and verifying scrape runs.
 *
 * Note: employersStale30Days counts employers 30-59 days stale (exclusive).
 * employersStale60Days counts employers 60+ days stale.
 */
export async function getFairChanceRedisStats(): Promise<FairChanceStats> {
	const redis = getRedis();

	// Use SCAN instead of KEYS to avoid blocking Redis
	const keys: string[] = [];
	let cursor = "0";
	do {
		const [nextCursor, batch] = await redis.scan(
			cursor,
			"MATCH",
			`${REDIS_KEY_PREFIX}*`,
			"COUNT",
			100
		);
		cursor = nextCursor;
		keys.push(...batch);
	} while (cursor !== "0");

	if (keys.length === 0) {
		return {
			totalEmployers: 0,
			oldestLastSeen: null,
			newestLastSeen: null,
			employersSeenToday: 0,
			employersStale30Days: 0,
			employersStale60Days: 0,
		};
	}

	// Batch fetch all lastSeen values with pipeline
	const pipeline = redis.pipeline();
	for (const key of keys) {
		pipeline.hget(key, "lastSeen");
	}
	const results = await pipeline.exec();

	let oldest: string | null = null;
	let newest: string | null = null;
	let seenToday = 0;
	let stale30 = 0;
	let stale60 = 0;

	const now = Date.now();
	const today = new Date().toISOString().slice(0, 10);
	const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;
	const sixtyDaysAgo = now - 60 * 24 * 60 * 60 * 1000;

	for (const result of results || []) {
		// Redis pipeline returns [error, value] tuples
		const [err, value] = result as [Error | null, string | null];
		if (err || !value) continue;
		const lastSeen = value;

		const lastSeenMs = new Date(lastSeen).getTime();

		if (lastSeen.startsWith(today)) seenToday++;
		// Exclusive buckets: 30-59 days vs 60+ days
		if (lastSeenMs < sixtyDaysAgo) {
			stale60++;
		} else if (lastSeenMs < thirtyDaysAgo) {
			stale30++;
		}

		if (!oldest || lastSeen < oldest) oldest = lastSeen;
		if (!newest || lastSeen > newest) newest = lastSeen;
	}

	return {
		totalEmployers: keys.length,
		oldestLastSeen: oldest,
		newestLastSeen: newest,
		employersSeenToday: seenToday,
		employersStale30Days: stale30,
		employersStale60Days: stale60,
	};
}

// ============================================================================
// CLI
// ============================================================================

async function main() {
	console.log("═".repeat(60));
	console.log("Florida Fair Chance Employers Scraper");
	console.log("═".repeat(60) + "\n");

	try {
		// Test FlareSolverr connection
		console.log("Testing FlareSolverr connection...");
		await fetch(FLARESOLVERR_URL.replace("/v1", ""), { method: "GET" });
		console.log("✓ FlareSolverr is running\n");
	} catch {
		console.error("❌ FlareSolverr is not running!");
		console.error("Start it with:");
		console.error(
			"  docker run -d --name=flaresolverr -p 8191:8191 ghcr.io/flaresolverr/flaresolverr:latest"
		);
		process.exit(1);
	}

	const result = await scrapeFairChanceEmployers({
		maxPages: DEFAULT_MAX_PAGES,
		delayMs: 2500, // Be nice to Indeed
		storeToRedis: true,
	});

	console.log("\n" + "─".repeat(60));
	console.log("Top 20 Fair Chance Employers by Job Count:");
	console.log("─".repeat(60));

	for (const e of result.employers.slice(0, 20)) {
		console.log(`\n${e.name} (${e.jobCount} jobs)`);
		console.log(`   Locations: ${e.locations.slice(0, 3).join(", ")}`);
		console.log(`   Roles: ${e.jobTitles.slice(0, 3).join(", ")}`);
	}

	console.log("\n" + "─".repeat(60));
	console.log("Scrape Stats:");
	console.log(`   Pages scraped: ${result.stats.pagesScraped}`);
	console.log(`   Jobs seen: ${result.stats.jobsSeen}`);
	console.log(`   New employers: ${result.stats.newEmployers}`);
	console.log(`   Existing touched: ${result.stats.existingEmployersTouched}`);
	if (result.stats.earlyExitReason) {
		console.log(`   Early exit: ${result.stats.earlyExitReason}`);
	}
	console.log("\n" + "─".repeat(60));
	console.log(`Data saved to: ${DATA_DIR}/`);
	console.log("  - florida-fair-chance-employers.json");
	console.log("  - florida-fair-chance-employers.tsv");
}

// Run if main module
if (require.main === module || process.argv[1]?.includes("fair-chance-employers")) {
	main().catch(console.error);
}
