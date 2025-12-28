/**
 * Craigslist Scraper using fetch + cheerio
 *
 * Scrapes job listings from Craigslist South Florida.
 * Uses static HTML fallback (no browser required).
 * FlareSolverr is NOT required - Craigslist doesn't use Cloudflare.
 *
 * API matches Snagajob scraper for pipeline compatibility.
 */

import * as cheerio from "cheerio";

// Craigslist region codes for South Florida
export const REGIONS = {
	mdc: "Miami-Dade",
	brw: "Broward",
	pbc: "Palm Beach",
} as const;

export type RegionCode = keyof typeof REGIONS;

// Craigslist category codes
export const CATEGORIES = {
	jjj: "job",
	ggg: "gig",
} as const;

export type CategoryCode = keyof typeof CATEGORIES;
export type JobType = (typeof CATEGORIES)[CategoryCode];

// Job interface - maps to SnagajobJob for pipeline compatibility
export interface CraigslistJob {
	// Core fields (required)
	id: string;
	title: string;
	company: string;
	pay: string;
	applyUrl: string;
	isUrgent: boolean;
	isEasyApply: boolean;

	// Parsed compensation
	payMin?: number;
	payMax?: number;
	payType?: string;

	// Location
	city?: string;
	state?: string;
	zip?: string;
	latitude?: number;
	longitude?: number;
	distance?: number;

	// Job metadata
	jobType?: string;
	postedDate?: string;

	// Extended fields from detail page
	description?: string;
	descriptionText?: string;
	industry?: string;
	industries?: Array<string>;
	employmentTypes?: Array<string>;
	address?: string;
	fullAddress?: string;

	// Craigslist-specific
	region?: string;
	category?: string;
	attributes?: Record<string, string>;
}

// Options interface
export interface ScrapeOptions {
	region: RegionCode;
	category?: CategoryCode;
	maxPages?: number;
	onProgress?: (msg: string) => void;
	onPage?: (page: number, total: number, jobs: Array<CraigslistJob>) => void;
}

// Rate limiting constants
const RATE_LIMITS = {
	listingPageDelay: 500,
	detailPageDelay: 100,
	detailConcurrency: 10,
	regionDelay: 1000,
};

const USER_AGENT =
	"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

/**
 * No-op for backwards compatibility.
 * Browser cleanup is no longer needed with fetch-based scraping.
 */
export async function closeBrowser(): Promise<void> {
	// No-op - no browser to close
}

// Parse compensation text to structured format
interface ParsedCompensation {
	min?: number;
	max?: number;
	type?: string;
	raw: string;
}

export function parseCompensation(raw: string): ParsedCompensation {
	const result: ParsedCompensation = { raw };
	if (!raw) return result;

	const normalized = raw.trim().toLowerCase();

	// Skip non-numeric values
	if (
		normalized === "competitive" ||
		normalized === "tbd" ||
		normalized === "doe" ||
		normalized === "negotiable"
	) {
		return result;
	}

	// Weekly range: "Weekly $2000-$3500" or "weekly $2,000 - $3,500"
	const weeklyMatch = raw.match(
		/weekly\s*\$?([\d,]+(?:\.\d{2})?)\s*[-–]\s*\$?([\d,]+(?:\.\d{2})?)/i
	);
	if (weeklyMatch) {
		result.min = parseFloat(weeklyMatch[1].replace(/,/g, ""));
		result.max = parseFloat(weeklyMatch[2].replace(/,/g, ""));
		result.type = "weekly";
		return result;
	}

	// Salary range: "$50,000-$70,000/year" or "$50k-70k"
	const salaryMatch = raw.match(
		/\$?([\d,]+(?:k)?)\s*[-–]\s*\$?([\d,]+(?:k)?)\s*(?:\/|\s*per\s*)?(?:year|yr|annually)/i
	);
	if (salaryMatch) {
		result.min = parseNumberWithK(salaryMatch[1]);
		result.max = parseNumberWithK(salaryMatch[2]);
		result.type = "salary";
		return result;
	}

	// Daily rate: "$150/day"
	const dailyMatch = raw.match(
		/\$?([\d,]+(?:\.\d{2})?)\s*(?:\/|\s*per\s*)day/i
	);
	if (dailyMatch) {
		result.min = parseFloat(dailyMatch[1].replace(/,/g, ""));
		result.type = "daily";
		return result;
	}

	// "Up to $X/hr" - check BEFORE other hourly patterns
	const upToMatch = raw.match(/up\s+to\s+\$?([\d.]+)\s*(?:\/hr|\/hour|per\s*hour)?/i);
	if (upToMatch) {
		result.max = parseFloat(upToMatch[1]);
		result.type = "hourly";
		return result;
	}

	// Hourly range: "$16-$40" or "$16 - $40" or "$16-40"
	const hourlyRangeMatch = raw.match(
		/\$?([\d.]+)\s*[-–]\s*\$?([\d.]+)(?:\s*(?:\/|\s*per\s*)?(?:hr|hour|hourly)?)?/i
	);
	if (hourlyRangeMatch) {
		result.min = parseFloat(hourlyRangeMatch[1]);
		result.max = parseFloat(hourlyRangeMatch[2]);
		// If both values are under 100, assume hourly
		if (result.min < 100 && result.max < 100) {
			result.type = "hourly";
		}
		return result;
	}

	// Single hourly: "17/hr" or "$17/hour" or "$17 per hour"
	const hourlyMatch = raw.match(
		/\$?([\d.]+)\s*(?:\/|\s*per\s*)(?:hr|hour|hourly)/i
	);
	if (hourlyMatch) {
		result.min = parseFloat(hourlyMatch[1]);
		result.type = "hourly";
		return result;
	}

	// Just a number with dollar sign: "$18" or "$18.00"
	const simpleMatch = raw.match(/^\$?([\d.]+)(?:\s*(?:per\s+)?hour)?$/i);
	if (simpleMatch) {
		const value = parseFloat(simpleMatch[1]);
		if (value < 100) {
			result.min = value;
			result.type = "hourly";
		}
		return result;
	}

	return result;
}

function parseNumberWithK(str: string): number {
	const cleaned = str.replace(/,/g, "").toLowerCase();
	if (cleaned.endsWith("k")) {
		return parseFloat(cleaned.slice(0, -1)) * 1000;
	}
	return parseFloat(cleaned);
}

// Build search URL for a region
function buildSearchUrl(region: string, category: CategoryCode = "jjj", postedToday = true): string {
	const params = new URLSearchParams();
	if (postedToday) {
		params.set("postedToday", "1");
	}
	const queryString = params.toString();
	const base = `https://miami.craigslist.org/search/${region}/${category}`;
	return queryString ? `${base}?${queryString}` : base;
}

// Fetch HTML from URL
async function fetchHtml(url: string): Promise<string> {
	const response = await fetch(url, {
		headers: { "User-Agent": USER_AGENT },
	});

	if (!response.ok) {
		throw new Error(`HTTP ${response.status}: ${response.statusText}`);
	}

	return response.text();
}

// Scrape listing page using static HTML fallback
async function scrapeListingPage(
	region: string,
	category: CategoryCode = "jjj"
): Promise<Array<CraigslistJob>> {
	const url = buildSearchUrl(region, category, true);
	const html = await fetchHtml(url);
	const $ = cheerio.load(html);

	const jobs: Array<CraigslistJob> = [];
	const jobType = CATEGORIES[category];

	// Craigslist serves static HTML fallback with cl-static-search-result
	$(".cl-static-search-result").each((_, el) => {
		const $el = $(el);
		const title = $el.attr("title") || $el.find(".title").text().trim();
		const href = $el.find("a").attr("href") || "";
		const price = $el.find(".price").text().trim();
		const location = $el.find(".location").text().trim();

		// Extract ID from URL: /mdc/lab/d/hialeah-driver/7902991535.html -> 7902991535
		const idMatch = href.match(/\/(\d+)\.html$/);
		const pid = idMatch ? idMatch[1] : "";

		if (!pid) return; // Skip if no ID found

		const parsed = parseCompensation(price);

		jobs.push({
			id: pid,
			title,
			company: "Unknown Employer",
			pay: price,
			applyUrl: href.startsWith("http") ? href : `https://miami.craigslist.org${href}`,
			isUrgent: false,
			isEasyApply: false,
			postedDate: "",
			city: location,
			state: "FL",
			region,
			jobType,
			payMin: parsed.min,
			payMax: parsed.max,
			payType: parsed.type,
		});
	});

	return jobs;
}

// Scrape detail page for full job info
async function scrapeDetailPage(job: CraigslistJob): Promise<Partial<CraigslistJob>> {
	try {
		const html = await fetchHtml(job.applyUrl);
		const $ = cheerio.load(html);

		const details: Partial<CraigslistJob> = {};

		// Title
		const title = $("#titletextonly").text().trim();
		if (title) details.title = title;

		// Company (only ~30% have this)
		const company = $("h2.company-name").text().trim();
		if (company) details.company = company;

		// Description
		const $body = $("#postingbody");
		if ($body.length) {
			details.description = $body.html() || "";
			details.descriptionText = $body
				.text()
				.replace(/QR Code Link to This Post/g, "")
				.trim();
		}

		// Map coordinates
		const $map = $("#map");
		if ($map.length) {
			const lat = $map.attr("data-latitude");
			const lng = $map.attr("data-longitude");
			if (lat) details.latitude = parseFloat(lat);
			if (lng) details.longitude = parseFloat(lng);
		}

		// Posted date
		const datetime = $("time.date.timeago").attr("datetime");
		if (datetime) details.postedDate = datetime;

		// Attributes
		const attributes: Record<string, string> = {};
		$(".attrgroup .attr").each((_, attr) => {
			const label = $(attr).find(".labl").text().replace(":", "").trim();
			const value = $(attr).find(".valu").text().trim();
			if (label && value) {
				attributes[label] = value;
			}
		});
		if (Object.keys(attributes).length > 0) {
			details.attributes = attributes;
		}

		// Extract specific attributes
		if (attributes.compensation) {
			details.pay = attributes.compensation;
			const parsed = parseCompensation(attributes.compensation);
			if (parsed.min !== undefined) details.payMin = parsed.min;
			if (parsed.max !== undefined) details.payMax = parsed.max;
			if (parsed.type !== undefined) details.payType = parsed.type;
		}
		if (attributes["employment type"]) {
			details.employmentTypes = [attributes["employment type"]];
		}

		return details;
	} catch (err) {
		console.error(`[Craigslist] Failed to scrape detail ${job.id}:`, err);
		return {};
	}
}

/**
 * Scrape job listings only (no detail pages).
 * Returns jobs with basic info but no descriptions.
 * Use enrichJobDetails() to fetch full details.
 */
export async function scrapeCraigslistListings(
	options: ScrapeOptions
): Promise<Array<CraigslistJob>> {
	const {
		region,
		category = "jjj",
		onProgress = console.log,
		onPage = () => {},
	} = options;

	const regionName = REGIONS[region];
	const categoryName = CATEGORIES[category];
	const debug = (msg: string) =>
		console.log(`[DEBUG ${new Date().toISOString()}] [${regionName}/${categoryName}] ${msg}`);

	debug("Starting Craigslist scrape (listings only)");

	const allJobs: Array<CraigslistJob> = [];
	const seenIds = new Set<string>();

	onProgress(`Scraping ${regionName} ${categoryName}s...`);

	const jobs = await scrapeListingPage(region, category);

	// Dedupe by ID
	for (const job of jobs) {
		if (!seenIds.has(job.id)) {
			seenIds.add(job.id);
			allJobs.push(job);
		}
	}

	debug(`Region ${region}: ${jobs.length} jobs`);
	onPage(1, 1, allJobs);

	debug(`Listings complete: ${allJobs.length} jobs`);
	onProgress(`Found ${allJobs.length} listings`);

	return allJobs;
}

/**
 * Enrich jobs with full details from individual job pages.
 * Modifies jobs in-place (same pattern as Snagajob).
 */
export async function enrichJobDetails(
	jobs: Array<CraigslistJob>,
	onProgress: (msg: string) => void,
	onBatchComplete?: (batch: Array<CraigslistJob>) => void,
	batchSize = 10
): Promise<void> {
	const total = jobs.length;
	let completed = 0;
	let enriched = 0;

	// Process in batches with concurrency limit
	for (let i = 0; i < jobs.length; i += batchSize) {
		const batch = jobs.slice(i, i + batchSize);

		// Fetch all in batch concurrently
		const results = await Promise.all(
			batch.map(async (job, idx) => {
				// Small delay to stagger requests
				await new Promise((r) => setTimeout(r, idx * RATE_LIMITS.detailPageDelay));

				try {
					const details = await scrapeDetailPage(job);
					return { job, details, success: true };
				} catch (err) {
					console.error(`[Craigslist] Failed to enrich ${job.id}:`, err);
					return { job, details: {}, success: false };
				}
			})
		);

		// Apply results to jobs
		for (const { job, details, success } of results) {
			if (success && Object.keys(details).length > 0) {
				// Update title if better version found
				if (details.title) job.title = details.title;
				// Update company if found (don't override with empty)
				if (details.company) job.company = details.company;
				// Description
				if (details.description) job.description = details.description;
				if (details.descriptionText) job.descriptionText = details.descriptionText;
				// Coordinates
				if (details.latitude) job.latitude = details.latitude;
				if (details.longitude) job.longitude = details.longitude;
				// Posted date (prefer detail page)
				if (details.postedDate) job.postedDate = details.postedDate;
				// Compensation (prefer detail page if more specific)
				if (details.payMin !== undefined) job.payMin = details.payMin;
				if (details.payMax !== undefined) job.payMax = details.payMax;
				if (details.payType !== undefined) job.payType = details.payType;
				if (details.pay) job.pay = details.pay;
				// Employment
				if (details.employmentTypes) job.employmentTypes = details.employmentTypes;
				// Attributes
				if (details.attributes) job.attributes = details.attributes;

				enriched++;
			}
		}

		// Call batch complete callback with enriched jobs
		if (onBatchComplete) {
			const enrichedBatch = batch.filter((j) => j.descriptionText);
			if (enrichedBatch.length > 0) {
				onBatchComplete(enrichedBatch);
			}
		}

		completed += batch.length;
		onProgress(`Enriching jobs: ${completed}/${total} (${enriched} enriched)`);

		// Small delay between batches
		if (i + batchSize < jobs.length) {
			await new Promise((r) => setTimeout(r, RATE_LIMITS.listingPageDelay));
		}
	}
}

/**
 * Full scrape: listings + details.
 * For backwards compatibility.
 */
export async function scrapeCraigslist(
	options: ScrapeOptions
): Promise<Array<CraigslistJob>> {
	const { region, category = "jjj", onProgress = console.log } = options;

	const regionName = REGIONS[region];
	const categoryName = CATEGORIES[category];
	const debug = (msg: string) =>
		console.log(`[DEBUG ${new Date().toISOString()}] [${regionName}/${categoryName}] ${msg}`);

	// Get listings
	const allJobs = await scrapeCraigslistListings(options);

	// Enrich with details
	if (allJobs.length > 0) {
		debug(`\n--- Enriching ${allJobs.length} jobs with full details ---`);
		onProgress("Enriching job details...");
		await enrichJobDetails(allJobs, onProgress);
		const withCoords = allJobs.filter((j) => j.latitude && j.longitude).length;
		const withDesc = allJobs.filter((j) => j.description).length;
		debug(
			`Enriched: ${withCoords}/${allJobs.length} with coords, ${withDesc}/${allJobs.length} with descriptions`
		);
	}

	return allJobs;
}

// Test runner
if (import.meta.main) {
	(async () => {
		console.log("Testing Craigslist scraper (fetch + cheerio) - ALL REGIONS + ALL CATEGORIES\n");
		console.log("=".repeat(60));

		try {
			const regionCodes = Object.keys(REGIONS) as RegionCode[];
			const categoryCodes = Object.keys(CATEGORIES) as CategoryCode[];
			const allJobs: Array<CraigslistJob> = [];
			const statsByCategory: Record<string, number> = { job: 0, gig: 0 };

			// Step 1: Scrape all regions and categories
			for (const category of categoryCodes) {
				const categoryName = CATEGORIES[category];
				console.log(`\n${"=".repeat(60)}`);
				console.log(`CATEGORY: ${categoryName.toUpperCase()}S (${category})`);
				console.log("=".repeat(60));

				for (const region of regionCodes) {
					const regionName = REGIONS[region];
					console.log(`\n--- ${regionName} (${region}) ---`);

					const jobs = await scrapeCraigslistListings({
						region,
						category,
						onProgress: (msg) => console.log(`  ${msg}`),
					});

					console.log(`  Listings: ${jobs.length}`);
					statsByCategory[categoryName] += jobs.length;
					allJobs.push(...jobs);
				}
			}

			console.log("\n" + "=".repeat(60));
			console.log(`TOTAL SCRAPED: ${allJobs.length}`);
			console.log(`  Jobs: ${statsByCategory.job}`);
			console.log(`  Gigs: ${statsByCategory.gig}`);

			// Step 2: Dedupe by external ID
			const seen = new Set<string>();
			const uniqueJobs = allJobs.filter((job) => {
				if (seen.has(job.id)) return false;
				seen.add(job.id);
				return true;
			});

			const uniqueJobCount = uniqueJobs.filter((j) => j.jobType === "job").length;
			const uniqueGigCount = uniqueJobs.filter((j) => j.jobType === "gig").length;

			console.log(`UNIQUE BY ID: ${uniqueJobs.length}`);
			console.log(`  Jobs: ${uniqueJobCount}`);
			console.log(`  Gigs: ${uniqueGigCount}`);
			console.log(`DUPLICATES REMOVED: ${allJobs.length - uniqueJobs.length}`);
			console.log("=".repeat(60));

			// Step 3: Show sample jobs and gigs
			const sampleJobs = uniqueJobs.filter((j) => j.jobType === "job").slice(0, 3);
			const sampleGigs = uniqueJobs.filter((j) => j.jobType === "gig").slice(0, 3);

			if (sampleJobs.length > 0) {
				console.log("\nSAMPLE JOBS:");
				for (const job of sampleJobs) {
					console.log(`  - ${job.title} @ ${job.company} (${job.city || "?"})`);
				}
			}

			if (sampleGigs.length > 0) {
				console.log("\nSAMPLE GIGS:");
				for (const gig of sampleGigs) {
					console.log(`  - ${gig.title} @ ${gig.company} (${gig.city || "?"})`);
				}
			}

			// Step 4: Enrich a sample of jobs
			const sampleToEnrich = uniqueJobs.slice(0, 5);
			console.log(`\nEnriching ${sampleToEnrich.length} sample jobs...`);

			await enrichJobDetails(
				sampleToEnrich,
				(msg) => console.log(`  ${msg}`),
				(batch) => {
					console.log(`  Batch ready: ${batch.length} items`);
				},
				5
			);

			console.log("\n" + "=".repeat(60));
			console.log("SAMPLE ENRICHED JOB:");
			const enrichedSample = sampleToEnrich.find((j) => j.descriptionText);
			if (enrichedSample) {
				console.log(`  Title: ${enrichedSample.title}`);
				console.log(`  Company: ${enrichedSample.company}`);
				console.log(`  Pay: ${enrichedSample.pay}`);
				console.log(`  Location: ${enrichedSample.city}, ${enrichedSample.state}`);
				console.log(`  Coords: ${enrichedSample.latitude}, ${enrichedSample.longitude}`);
				console.log(`  Description: ${enrichedSample.descriptionText?.slice(0, 150)}...`);
				console.log(`  Attributes:`, enrichedSample.attributes);
			}
			console.log("=".repeat(60));
		} catch (err) {
			console.error("Test failed:", err);
			process.exit(1);
		}
	})();
}
