import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { getRedis, closeRedis, getRedisStatus } from './redis';

describe('getRedis()', () => {
  const originalEnv = process.env.REDIS_URL;

  afterEach(async () => {
    // Restore original env
    if (originalEnv) {
      process.env.REDIS_URL = originalEnv;
    }
    await closeRedis();
  });

  test('throws if REDIS_URL not set', () => {
    delete process.env.REDIS_URL;
    expect(() => getRedis()).toThrow('REDIS_URL');
  });
});

describe('getRedisReady()', () => {
  test('exists and validates connection before returning', async () => {
    // This function should exist and wait for connection
    // Currently it doesn't exist - this test documents the requirement
    const { getRedisReady } = await import('./redis');

    expect(typeof getRedisReady).toBe('function');
  });

  test('throws if connection fails within timeout', async () => {
    const originalEnv = process.env.REDIS_URL;
    process.env.REDIS_URL = 'redis://nonexistent.invalid:6379';

    try {
      const { getRedisReady } = await import('./redis');
      await expect(getRedisReady()).rejects.toThrow();
    } finally {
      process.env.REDIS_URL = originalEnv;
    }
  });
});
