import Redis from "ioredis";

let redis: Redis | null = null;
let connectionFailures = 0;
let isConnected = false;

export function getRedis(): Redis {
  if (!redis) {
    const url = process.env.REDIS_URL;
    if (!url) {
      throw new Error("REDIS_URL environment variable is required");
    }

    redis = new Redis(url, {
      maxRetriesPerRequest: 3,
      retryStrategy(times) {
        // Exponential backoff with max 30s
        const delay = Math.min(times * 500, 30000);
        console.warn(`[Redis] Retry attempt ${times}, waiting ${delay}ms`);
        return delay;
      },
    });

    redis.on("error", (err) => {
      connectionFailures++;
      isConnected = false;
      console.error(`[Redis] Connection error (failures: ${connectionFailures}):`, err.message);
    });

    redis.on("connect", () => {
      connectionFailures = 0;
      isConnected = true;
      console.log("[Redis] Connected");
    });

    redis.on("close", () => {
      isConnected = false;
      console.warn("[Redis] Connection closed");
    });

    redis.on("reconnecting", () => {
      console.log("[Redis] Reconnecting...");
    });
  }
  return redis;
}

export function getRedisStatus(): { isConnected: boolean; connectionFailures: number } {
  return { isConnected, connectionFailures };
}

export async function closeRedis(): Promise<void> {
  if (redis) {
    await redis.quit();
    redis = null;
  }
}
