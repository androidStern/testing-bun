/**
 * Snagajob Scraper using FlareSolverr
 *
 * Uses FlareSolverr to bypass Cloudflare, then hits the API directly.
 * Much faster and more reliable than browser-based scraping.
 *
 * Requirements:
 *   docker run -d --name=flaresolverr -p 8191:8191 ghcr.io/flaresolverr/flaresolverr:latest
 */

const FLARESOLVERR_URL =
	process.env.FLARESOLVERR_URL || "http://localhost:8191/v1";

export interface SnagajobJob {
	// Core fields
	id: string;
	title: string;
	company: string;
	pay: string;
	payMin?: number;
	payMax?: number;
	payType?: string;
	city?: string;
	state?: string;
	zip?: string;
	latitude?: number;
	longitude?: number;
	distance?: number;
	jobType?: string;
	isUrgent: boolean;
	isEasyApply: boolean;
	applyUrl: string;
	postedDate?: string;

	// Extended fields from detail endpoint
	description?: string; // Full HTML job description
	descriptionText?: string; // Plain text version (stripped HTML)
	industry?: string; // primaryIndustryName
	industries?: string[]; // industries array
	employmentTypes?: string[]; // categories array (Full-time, Part-time, etc.)
	address?: string; // location.addressLine1
	fullAddress?: string; // location.locationName
	onetCode?: string; // O*NET job code
	onetTitle?: string; // O*NET job title
	experienceLevel?: string; // experienceLevel
	minimumAge?: number; // minimumAge
	logoUrl?: string; // logoUrl
	brandName?: string; // brandTemplateName
	customerName?: string; // customerName (employer)

	// Extracted from fextures array
	benefits?: string[]; // items with usageFlags containing "jobBenefits"
	skills?: string[]; // items with usageFlags containing "skills"
	responsibilities?: string[]; // items with usageFlags containing "responsibilities"
	workSchedule?: string[]; // items with usageFlags containing "workhours"
	educationRequired?: string[]; // items with usageFlags containing "educationRequirements"
}

// HTML entity decoding for API responses
function decodeHtmlEntities(html: string): string {
	if (!html) return "";
	return html
		.replace(/&lt;/g, "<")
		.replace(/&gt;/g, ">")
		.replace(/&amp;/g, "&")
		.replace(/&quot;/g, '"')
		.replace(/&#39;/g, "'")
		.replace(/&nbsp;/g, " ");
}

// Strip HTML tags and clean up whitespace
function stripHtml(html: string): string {
	if (!html) return "";
	return decodeHtmlEntities(html)
		.replace(/<!\[CDATA\[/g, "")
		.replace(/\]\]>/g, "")
		.replace(/<[^>]*>/g, " ")
		.replace(/\s+/g, " ")
		.trim();
}

// Parse fextures array to extract categorized features
function parseFextures(fextures: any[]): {
	benefits: string[];
	skills: string[];
	responsibilities: string[];
	workSchedule: string[];
	education: string[];
} {
	const result = {
		benefits: [] as string[],
		skills: [] as string[],
		responsibilities: [] as string[],
		workSchedule: [] as string[],
		education: [] as string[],
	};

	for (const f of fextures || []) {
		const flags = f.usageFlags || [];
		const name = f.displayName?.display || f.name;
		if (!name) continue;

		if (flags.includes("jobBenefits")) result.benefits.push(name);
		if (flags.includes("skills")) result.skills.push(name);
		if (flags.includes("responsibilities")) result.responsibilities.push(name);
		if (flags.includes("workhours")) result.workSchedule.push(name);
		if (flags.includes("educationRequirements")) result.education.push(name);
	}

	return result;
}

export const LOCATIONS = {
	miami: { latitude: 25.7617, longitude: -80.1918 },
	fortLauderdale: { latitude: 26.1224, longitude: -80.1373 },
	westPalmBeach: { latitude: 26.7153, longitude: -80.0534 },
};

interface FlareSolverrResponse {
	status: string;
	message: string;
	solution: {
		url: string;
		status: number;
		cookies: Array<{
			name: string;
			value: string;
			domain: string;
		}>;
		userAgent: string;
		response: string;
	};
}

interface ApiResponse {
	actualTotal: number;
	list: any[];
}

// Fetch URL via FlareSolverr
async function fetchViaFlareSolverr(url: string): Promise<any> {
	const response = await fetch(FLARESOLVERR_URL, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({
			cmd: "request.get",
			url,
			maxTimeout: 60000,
		}),
	});

	const data = (await response.json()) as FlareSolverrResponse;

	if (data.status !== "ok") {
		throw new Error(`FlareSolverr error: ${data.message}`);
	}

	if (data.solution.status !== 200) {
		throw new Error(`Request failed: ${data.solution.status}`);
	}

	// Parse JSON response - may be wrapped in HTML <pre> tags
	let rawResponse = data.solution.response;

	// Extract JSON from <pre> tags if present
	const preMatch = rawResponse.match(/<pre[^>]*>([\s\S]*?)<\/pre>/i);
	if (preMatch) {
		rawResponse = preMatch[1];
	}

	try {
		return JSON.parse(rawResponse);
	} catch {
		// Return raw response if not JSON
		return rawResponse;
	}
}

// Enrich jobs with full details from individual job endpoint
export async function enrichJobDetails(
	jobs: SnagajobJob[],
	onProgress: (msg: string) => void,
	onBatchComplete?: (batch: SnagajobJob[]) => void, // Callback after each batch
	batchSize = 5, // FlareSolverr is slower, use smaller batches
): Promise<void> {
	const total = jobs.length;
	let completed = 0;
	let enriched = 0;

	// Process in batches
	for (let i = 0; i < jobs.length; i += batchSize) {
		const batch = jobs.slice(i, i + batchSize);

		// Fetch all in batch concurrently
		const results = await Promise.all(
			batch.map(async (job) => {
				try {
					const url = `https://www.snagajob.com/api/jobs/v1/${job.id}`;
					const data = await fetchViaFlareSolverr(url);

					// Parse fextures for categorized features
					const features = parseFextures(data.fextures || []);

					return {
						id: job.id,
						success: true,
						// Coordinates
						latitude: data.latitude ?? null,
						longitude: data.longitude ?? null,
						// Description
						description: data.description
							? decodeHtmlEntities(data.description)
							: null,
						descriptionText: data.description
							? stripHtml(data.description)
							: null,
						// Industry
						industry: data.primaryIndustryName
							? decodeHtmlEntities(data.primaryIndustryName)
							: null,
						industries:
							data.industries?.map((i: string) => decodeHtmlEntities(i)) || [],
						// Employment types
						employmentTypes: data.categories || [],
						// Address
						address: data.location?.addressLine1 || null,
						fullAddress: data.location?.locationName || null,
						// O*NET classification
						onetCode: data.onetCode || null,
						onetTitle: data.onetName || null,
						// Other details
						experienceLevel: data.experienceLevel || null,
						minimumAge: data.minimumAge || null,
						logoUrl: data.logoUrl || null,
						brandName: data.brandTemplateName || null,
						customerName: data.customerName || null,
						// Categorized features
						benefits: features.benefits,
						skills: features.skills,
						responsibilities: features.responsibilities,
						workSchedule: features.workSchedule,
						educationRequired: features.education,
					};
				} catch (err) {
					console.error(`[Snagajob] Failed to enrich job ${job.id}:`, err);
					throw err;
				}
			}),
		);

		// Apply results to jobs
		for (const result of results) {
			const job = jobs.find((j) => j.id === result.id);
			if (job && result.success) {
				// Coordinates
				if (result.latitude) job.latitude = result.latitude;
				if (result.longitude) job.longitude = result.longitude;
				// Description
				if (result.description) job.description = result.description;
				if (result.descriptionText)
					job.descriptionText = result.descriptionText;
				// Industry
				if (result.industry) job.industry = result.industry;
				if (result.industries?.length) job.industries = result.industries;
				// Employment types
				if (result.employmentTypes?.length)
					job.employmentTypes = result.employmentTypes;
				// Address
				if (result.address) job.address = result.address;
				if (result.fullAddress) job.fullAddress = result.fullAddress;
				// O*NET
				if (result.onetCode) job.onetCode = result.onetCode;
				if (result.onetTitle) job.onetTitle = result.onetTitle;
				// Other details
				if (result.experienceLevel)
					job.experienceLevel = result.experienceLevel;
				if (result.minimumAge) job.minimumAge = result.minimumAge;
				if (result.logoUrl) job.logoUrl = result.logoUrl;
				if (result.brandName) job.brandName = result.brandName;
				if (result.customerName) job.customerName = result.customerName;
				// Categorized features
				if (result.benefits?.length) job.benefits = result.benefits;
				if (result.skills?.length) job.skills = result.skills;
				if (result.responsibilities?.length)
					job.responsibilities = result.responsibilities;
				if (result.workSchedule?.length) job.workSchedule = result.workSchedule;
				if (result.educationRequired?.length)
					job.educationRequired = result.educationRequired;

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
			await new Promise((resolve) => setTimeout(resolve, 350));
		}
	}
}

// Map numeric wage types to strings
const WAGE_TYPE_MAP: Record<number, string> = {
	1: "hourly",
	2: "salary",
	3: "daily",
};

// Transform API job to our format
function transformJob(job: any): SnagajobJob {
	const wages = job.wages || job.wage || {};
	const wageType = wages.wageType;

	return {
		id: job.postingId,
		title: job.title || "",
		company: job.companyName || job.normalizedBrandName || "",
		pay: wages.text || wages.shortFormText || "",
		payMin: wages.min,
		payMax: wages.max,
		payType: wageType != null ? (WAGE_TYPE_MAP[wageType] || String(wageType)) : undefined,
		city: job.location?.city,
		state: job.location?.stateProvinceCode,
		zip: job.location?.postalCode,
		latitude: job.location?.geoLocation?.latitude,
		longitude: job.location?.geoLocation?.longitude,
		distance: job.distanceInMiles,
		jobType: job.categories?.[0],
		isUrgent:
			job.fextures?.includes("urgency") ||
			job.features?.includes("Urgently hiring") ||
			false,
		isEasyApply: job.isEasyApply || false,
		applyUrl: `https://www.snagajob.com/jobs/${job.postingId}`,
		postedDate: job.createdDate,
	};
}

export interface ScrapeOptions {
	latitude: number;
	longitude: number;
	locationName?: string;
	radiusInMiles?: number;
	promotedOnly?: boolean;
	maxPages?: number;
	onProgress?: (msg: string) => void;
	onPage?: (page: number, total: number, jobs: SnagajobJob[]) => void;
}

/**
 * Scrape job listings only (no detail pages).
 * Returns jobs with basic info but no descriptions.
 * Use enrichJobDetails() to fetch full details.
 */
export async function scrapeSnagajobListings(
	options: ScrapeOptions,
): Promise<SnagajobJob[]> {
	const {
		latitude,
		longitude,
		locationName = "location",
		radiusInMiles = 25,
		promotedOnly = true,
		maxPages = 50,
		onProgress = console.log,
		onPage = () => {},
	} = options;

	const debug = (msg: string) =>
		console.log(`[DEBUG ${new Date().toISOString()}] [${locationName}] ${msg}`);

	debug("Starting FlareSolverr-based scrape (listings only)");

	// Build API URL - uses start (1-indexed position) and num (page size)
	const pageSize = 30;
	const buildApiUrl = (start: number) => {
		const params = new URLSearchParams({
			latitude: latitude.toString(),
			longitude: longitude.toString(),
			location: locationName.toLowerCase(),
			radiusInMiles: radiusInMiles.toString(),
			promotedonly: promotedOnly.toString(),
			start: start.toString(),
			num: pageSize.toString(),
			includeEmptyWages: "true",
			expandOnets: "true",
			countStackedJobs: "true",
		});
		return `https://www.snagajob.com/api/jobs/v1/brand-group?${params}`;
	};

	const allJobs: SnagajobJob[] = [];
	const seenIds = new Set<string>();

	// Fetch first page to get total
	debug("Fetching page 1 via FlareSolverr...");
	onProgress("Loading search results...");

	const page1Data = (await fetchViaFlareSolverr(buildApiUrl(1))) as ApiResponse;
	const totalJobs = page1Data.actualTotal;
	const totalPages = Math.min(Math.ceil(totalJobs / pageSize), maxPages);

	debug(
		`Found ${totalJobs} jobs across ${totalPages} pages (${pageSize} per page)`,
	);
	onProgress(`Found ${totalJobs} jobs across ${totalPages} pages`);

	// Process page 1
	for (const job of page1Data.list || []) {
		if (!seenIds.has(job.postingId)) {
			seenIds.add(job.postingId);
			allJobs.push(transformJob(job));
		}
	}
	onPage(1, totalPages, allJobs);
	debug(`Page 1 done, ${allJobs.length} jobs`);

	// Fetch remaining pages using start offset (1-indexed)
	for (let pageNum = 2; pageNum <= totalPages; pageNum++) {
		const start = (pageNum - 1) * pageSize + 1;

		// Small delay between requests to avoid rate limiting
		await new Promise((resolve) =>
			setTimeout(resolve, 800 + Math.random() * 400),
		);

		debug(
			`Fetching page ${pageNum}/${totalPages} (start=${start}) via FlareSolverr...`,
		);

		let data: ApiResponse;
		try {
			data = (await fetchViaFlareSolverr(buildApiUrl(start))) as ApiResponse;
		} catch (err: unknown) {
			const message = err instanceof Error ? err.message : String(err);
			debug(`Page ${pageNum} failed: ${message}`);
			throw new Error(`Failed to fetch page ${pageNum}: ${message}`);
		}

		for (const job of data.list || []) {
			if (!seenIds.has(job.postingId)) {
				seenIds.add(job.postingId);
				allJobs.push(transformJob(job));
			}
		}

		onPage(pageNum, totalPages, allJobs);
		debug(`Page ${pageNum} done, ${allJobs.length} total jobs`);

		// Stop if we got fewer jobs than expected (reached the end)
		if (!data.list || data.list.length < pageSize) {
			debug("Received fewer jobs than page size, stopping pagination");
			break;
		}
	}

	debug(`Listings complete: ${allJobs.length} jobs`);
	return allJobs;
}

/**
 * Full scrape: listings + details.
 * For backwards compatibility.
 */
export async function scrapeSnagajob(
	options: ScrapeOptions,
): Promise<SnagajobJob[]> {
	const { onProgress = console.log, locationName = "location" } = options;

	const debug = (msg: string) =>
		console.log(`[DEBUG ${new Date().toISOString()}] [${locationName}] ${msg}`);

	// Get listings
	const allJobs = await scrapeSnagajobListings(options);

	// Enrich with details
	if (allJobs.length > 0) {
		debug(`\n--- Enriching ${allJobs.length} jobs with full details ---`);
		onProgress("Enriching job details...");
		await enrichJobDetails(allJobs, onProgress);
		const withCoords = allJobs.filter((j) => j.latitude && j.longitude).length;
		const withDesc = allJobs.filter((j) => j.description).length;
		debug(
			`Enriched: ${withCoords}/${allJobs.length} with coords, ${withDesc}/${allJobs.length} with descriptions`,
		);
		onProgress(
			`Enriched ${allJobs.length} jobs (${withCoords} with coords, ${withDesc} with descriptions)`,
		);
	}

	debug(`Scrape complete: ${allJobs.length} jobs`);
	return allJobs;
}

// Quick test
if (import.meta.main) {
	(async () => {
		console.log("Testing FlareSolverr scraper...\n");

		const jobs = await scrapeSnagajob({
			latitude: LOCATIONS.miami.latitude,
			longitude: LOCATIONS.miami.longitude,
			locationName: "Miami",
			radiusInMiles: 25,
			promotedOnly: false,
			onProgress: (msg) => console.log(`  ${msg}`),
			onPage: (page, total, jobs) =>
				console.log(`  Page ${page}/${total}: ${jobs.length} jobs`),
		});

		console.log(`\nTotal: ${jobs.length} jobs`);
		console.log("\nSample job:", JSON.stringify(jobs[0], null, 2));
	})();
}
