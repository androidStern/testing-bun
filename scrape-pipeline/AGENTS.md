# SCRAPE PIPELINE

## OVERVIEW

Standalone Bun server for job scraping and enrichment. Runs separately from Convex, communicates via HTTP with shared secret.

## STRUCTURE

```
scrape-pipeline/
├── server.ts                 # Main Hono server (port 3001)
├── fair-chance-employers.ts  # Second-chance employer database
├── transit-scorer.ts         # GTFS-based transit accessibility
├── scrapers/                 # Job source scrapers
├── lib/
│   └── enrichment/           # Job enrichment logic
├── company-matching/         # Fuzzy employer matching
├── dedup/                    # Job deduplication
└── inngest/                  # Pipeline-specific Inngest functions
```

## WHERE TO LOOK

| Task | Location |
|------|----------|
| Add scraper | `scrapers/` |
| Modify enrichment | `lib/enrichment/` |
| Transit scoring | `transit-scorer.ts` |
| Second-chance detection | `fair-chance-employers.ts` + `lib/enrichment/` |
| Deduplication | `dedup/` |

## CONVEX COMMUNICATION

Uses HTTP endpoints with shared secret authentication:

```typescript
// Calling Convex from pipeline
const response = await fetch(`${CONVEX_SITE_URL}/api/scraped-jobs/insert`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-Pipeline-Secret': process.env.SCRAPE_PIPELINE_SECRET,
  },
  body: JSON.stringify(jobData),
})
```

**Available endpoints:**
- `POST /api/scraped-jobs/insert` - Add new job
- `POST /api/scraped-jobs/enrich` - Add enrichment data
- `POST /api/scraped-jobs/indexed` - Mark as indexed in Typesense
- `POST /api/scraped-jobs/status` - Update status (for errors)
- `POST /api/scraped-jobs/exists` - Check if job exists (dedup)

## COMMANDS

```bash
bun run dev:scrape   # Start pipeline server on :3001
```

## DATA DEPENDENCIES

- **GTFS data**: `data/gtfs/` for transit calculations
- **Fair-chance employers**: `data/fair-chance/` for second-chance matching

## CONVENTIONS

- Uses Hono for HTTP server
- Inngest for async enrichment workflows
- Environment variables for all secrets and URLs
