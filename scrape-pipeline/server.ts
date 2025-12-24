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
import { enrichJobFn } from "./inngest/functions/enrich-job";
import { processBatch } from "./inngest/functions/process-batch";
import { getRedis, closeRedis } from "./lib/redis";
import { getTypesense, ensureJobsCollection, deleteJobDocuments } from "./lib/typesense";
import { loadTransitData } from "./transit-scorer";
import * as dedup from "./dedup/job-dedup-enhanced.js";

const PORT = parseInt(process.env.SCRAPE_PORT || "3001");

// Inngest serve handler
const inngestHandler = serve({
  client: inngest,
  functions: [scrapeBatch, enrichJobFn, processBatch],
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
  const health: Record<string, any> = {
    status: "ok",
    timestamp: new Date().toISOString(),
  };

  // Check Redis
  try {
    const redis = getRedis();
    await redis.ping();
    health.redis = "connected";
  } catch {
    health.redis = "disconnected";
  }

  // Check Typesense
  try {
    const typesense = getTypesense();
    await typesense.health.retrieve();
    health.typesense = "connected";
  } catch {
    health.typesense = "disconnected";
  }

  return Response.json(health);
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
