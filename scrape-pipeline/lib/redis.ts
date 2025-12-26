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

/**
 * Get Redis client and wait for connection to be ready.
 * Use this when you need to ensure Redis is connected before operations.
 *
 * @param timeoutMs Maximum time to wait for connection (default 5000ms)
 * @throws If connection fails or times out
 */
let connectionPromise: Promise<void> | null = null;

export async function getRedisReady(timeoutMs = 5000): Promise<Redis> {
  const redisClient = getRedis();

  // If already connected, return immediately
  if (isConnected) {
    return redisClient;
  }

  // Wait for connection (only create promise once)
  if (!connectionPromise) {
    connectionPromise = new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Redis connection timeout after ${timeoutMs}ms`));
      }, timeoutMs);

      redisClient.once('ready', () => {
        clearTimeout(timeout);
        resolve();
      });

      redisClient.once('error', (err) => {
        clearTimeout(timeout);
        reject(new Error(`Redis connection failed: ${err.message}`));
      });
    });
  }

  await connectionPromise;
  return redisClient;
}

export async function closeRedis(): Promise<void> {
  if (redis) {
    await redis.quit();
    redis = null;
  }
}
