/**
 * Recovery Jobs Pipeline Server
 *
 * Bun server that handles:
 * - Inngest webhook for job orchestration
 * - Health check endpoint
 * - Manual scrape triggers
 */

import { serve } from "inngest/bun";
import { inngest } from "./inngest/client";
import { scrapeBatch } from "./inngest/functions/scrape-batch";
import { processBatch } from "./inngest/functions/process-batch";
import { scrapeFairChance } from "./inngest/functions/scrape-fair-chance";
import { getRedis, closeRedis } from "./lib/redis";
import { getTypesense, ensureJobsCollection, deleteJobDocuments, JOBS_COLLECTION } from "./lib/typesense";
import { loadTransitData } from "./transit-scorer";
import * as dedup from "./dedup/job-dedup-enhanced.js";
import { getFairChanceRedisStats } from "./fair-chance-employers";

const PORT = parseInt(process.env.SCRAPE_PORT || "3001");

// Inngest serve handler
const inngestHandler = serve({
  client: inngest,
  functions: [scrapeBatch, processBatch, scrapeFairChance],
});

// Initialize services on startup
async function initialize() {
  console.log("[Server] Initializing services...");

  // Redis - REQUIRED for deduplication
  try {
    const redis = getRedis();
    await redis.ping();
    console.log("[Server] Redis connected");
  } catch (err) {
    console.error("[Server] Redis connection failed:", (err as Error).message);
    throw new Error("Redis is required for job deduplication");
  }

  // Typesense - REQUIRED for job indexing
  try {
    const typesense = getTypesense();
    await typesense.health.retrieve();
    console.log("[Server] Typesense connected");

    // Ensure jobs collection exists
    await ensureJobsCollection();
  } catch (err) {
    console.error("[Server] Typesense connection failed:", (err as Error).message);
    throw new Error("Typesense is required for job indexing");
  }

  // Transit data (pre-load for faster enrichment) - optional, just warn
  try {
    await loadTransitData();
    console.log("[Server] Transit data loaded");
  } catch (err) {
    console.warn("[Server] Transit data not loaded (scoring disabled):", (err as Error).message);
  }

  console.log("[Server] Initialization complete");
}

// Health check response
async function healthCheck(): Promise<Response> {
  const FLARESOLVERR_URL = process.env.FLARESOLVERR_URL || "http://localhost:8191/v1";

  const services: Record<string, { status: "healthy" | "unhealthy"; error?: string }> = {};
  let allHealthy = true;

  // Check Redis (required)
  try {
    const redis = getRedis();
    await redis.ping();
    services.redis = { status: "healthy" };
  } catch (err) {
    services.redis = { status: "unhealthy", error: (err as Error).message };
    allHealthy = false;
  }

  // Check Typesense (required)
  try {
    const typesense = getTypesense();
    await typesense.health.retrieve();
    services.typesense = { status: "healthy" };
  } catch (err) {
    services.typesense = { status: "unhealthy", error: (err as Error).message };
    allHealthy = false;
  }

  // Check FlareSolverr (required for scraping)
  try {
    const response = await fetch(FLARESOLVERR_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cmd: "sessions.list" }),
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    services.flaresolverr = { status: "healthy" };
  } catch (err) {
    services.flaresolverr = { status: "unhealthy", error: (err as Error).message };
    allHealthy = false;
  }

  const health = {
    status: allHealthy ? "healthy" : "unhealthy",
    timestamp: new Date().toISOString(),
    services,
  };

  return Response.json(health, { status: allHealthy ? 200 : 503 });
}

// Main server
const server = Bun.serve({
  port: PORT,

  async fetch(req) {
    const url = new URL(req.url);

    // Inngest webhook handler
    if (url.pathname.startsWith("/api/inngest")) {
      return inngestHandler(req);
    }

    // Health check
    if (url.pathname === "/health") {
      return healthCheck();
    }

    // Root - service info
    if (url.pathname === "/") {
      return Response.json({
        service: "recovery-jobs-pipeline",
        version: "1.0.0",
        endpoints: [
          { path: "/", description: "Service info" },
          { path: "/health", description: "Health check" },
          { path: "/api/inngest", description: "Inngest webhook" },
          { path: "/api/admin/cache/stats", description: "Cache statistics" },
          { path: "/api/admin/cache/clear", description: "Clear cache" },
          { path: "/api/admin/fair-chance/stats", description: "Fair chance employers statistics" },
        ],
      });
    }

    // Admin endpoints - require pipeline secret
    if (url.pathname.startsWith("/api/admin/")) {
      const secret = req.headers.get("X-Pipeline-Secret");
      if (secret !== process.env.CONVEX_PIPELINE_SECRET) {
        return new Response("Unauthorized", { status: 401 });
      }

      // Cache stats
      if (url.pathname === "/api/admin/cache/stats" && req.method === "GET") {
        try {
          const redis = getRedis();
          await dedup.initialize({ redis });
          const stats = await dedup.getStats();
          return Response.json(stats);
        } catch (err) {
          console.error("[Server] Cache stats error:", err);
          return Response.json({ error: (err as Error).message }, { status: 500 });
        }
      }

      // Fair chance employers stats
      if (url.pathname === "/api/admin/fair-chance/stats" && req.method === "GET") {
        try {
          const stats = await getFairChanceRedisStats();
          return Response.json(stats);
        } catch (err) {
          console.error("[Server] Fair chance stats error:", err);
          return Response.json({ error: (err as Error).message }, { status: 500 });
        }
      }

      // Clear cache
      if (url.pathname === "/api/admin/cache/clear" && req.method === "POST") {
        try {
          const redis = getRedis();
          await dedup.initialize({ redis });
          const body = await req.json();

          if (body.startDate && body.endDate) {
            // Clear by date range
            const startMs = new Date(body.startDate).getTime();
            const endMs = new Date(body.endDate).setHours(23, 59, 59, 999);
            const result = await dedup.clearByDateRange(startMs, endMs);
            return Response.json({ success: true, ...result });
          } else if (body.clearAll) {
            // Clear everything
            await dedup.clearAll();
            return Response.json({ success: true, message: "All cache cleared" });
          } else {
            return Response.json({ error: "Specify startDate/endDate or clearAll: true" }, { status: 400 });
          }
        } catch (err) {
          console.error("[Server] Cache clear error:", err);
          return Response.json({ error: (err as Error).message }, { status: 500 });
        }
      }

      // Delete from Typesense + Redis dedup cache
      if (url.pathname === "/api/admin/typesense/delete" && req.method === "POST") {
        try {
          const body = await req.json();
          const { typesenseIds, externalIds } = body;

          if (!typesenseIds || !Array.isArray(typesenseIds)) {
            return Response.json({ error: "Missing typesenseIds array" }, { status: 400 });
          }

          // Delete from Typesense
          const typesenseResult = await deleteJobDocuments(typesenseIds);

          // Delete from Redis dedup cache
          const redis = getRedis();
          await dedup.initialize({ redis });
          for (const externalId of externalIds || []) {
            await dedup.removeJob(externalId);
          }

          return Response.json({
            success: true,
            typesense: typesenseResult,
            dedupCleared: externalIds?.length || 0,
          });
        } catch (err) {
          console.error("[Server] Typesense delete error:", err);
          return Response.json({ error: (err as Error).message }, { status: 500 });
        }
      }

      // Nuke all jobs (dev only) - drops Typesense collection and clears Redis
      if (url.pathname === "/api/admin/nuke-all" && req.method === "POST") {
        // Safety: Only allow in development
        if (process.env.NODE_ENV === "production") {
          return new Response("Not allowed in production", { status: 403 });
        }

        try {
          // 1. Drop and recreate Typesense collection (faster than deleting docs)
          const typesense = getTypesense();
          try {
            await typesense.collections(JOBS_COLLECTION).delete();
            console.log("[Server] Typesense collection dropped");
          } catch (err: any) {
            if (err?.httpStatus !== 404) throw err; // Ignore if doesn't exist
          }
          await ensureJobsCollection();
          console.log("[Server] Typesense collection recreated");

          // 2. Clear Redis dedup cache
          const redis = getRedis();
          await dedup.initialize({ redis });
          await dedup.clearAll();
          console.log("[Server] Redis dedup cache cleared");

          return Response.json({
            success: true,
            message: "Typesense collection dropped and recreated, Redis cache cleared",
          });
        } catch (err) {
          console.error("[Server] Nuke-all error:", err);
          return Response.json({ error: (err as Error).message }, { status: 500 });
        }
      }
    }

    return new Response("Not Found", { status: 404 });
  },
});

// Graceful shutdown
process.on("SIGINT", async () => {
  console.log("\n[Server] Shutting down...");
  await closeRedis();
  server.stop();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  console.log("\n[Server] Shutting down...");
  await closeRedis();
  server.stop();
  process.exit(0);
});

// Start
console.log(`[Server] Starting on port ${PORT}...`);
initialize().then(() => {
  console.log(`[Server] Recovery Jobs Pipeline running at http://localhost:${PORT}`);
});
