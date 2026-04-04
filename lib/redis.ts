import Redis from 'ioredis';
import { prisma } from './db';

let redisClient: Redis | null = null;
let lastUrl: string | null = null;

/**
 * Get Redis URL from SystemConfig table
 */
async function getRedisUrl(): Promise<string | null> {
  try {
    const config = await prisma.systemConfig.findUnique({
      where: { key: 'redis_url' },
    });
    return config?.value || null;
  } catch {
    return null;
  }
}

/**
 * Get or create Redis client. Returns null if not configured.
 */
export async function getRedis(): Promise<Redis | null> {
  const url = await getRedisUrl();
  if (!url) {
    // Redis not configured
    if (redisClient) {
      redisClient.disconnect();
      redisClient = null;
      lastUrl = null;
    }
    return null;
  }

  // If URL changed, reconnect
  if (lastUrl !== url) {
    if (redisClient) {
      redisClient.disconnect();
    }
    redisClient = null;
    lastUrl = null;
  }

  if (!redisClient) {
    try {
      redisClient = new Redis(url, {
        maxRetriesPerRequest: 3,
        retryStrategy: (times) => {
          if (times > 3) return null;
          return Math.min(times * 200, 2000);
        },
        connectTimeout: 5000,
        lazyConnect: true,
      });
      await redisClient.connect();
      lastUrl = url;
    } catch (err) {
      console.error('Redis connection failed:', err);
      redisClient = null;
      lastUrl = null;
      return null;
    }
  }

  return redisClient;
}

/**
 * Cache wrapper - get from cache or execute function and cache result
 */
export async function cached<T>(
  key: string,
  fn: () => Promise<T>,
  ttlSeconds: number = 300 // 5 min default
): Promise<T> {
  const redis = await getRedis();
  if (redis) {
    try {
      const cached = await redis.get(key);
      if (cached) {
        return JSON.parse(cached) as T;
      }
    } catch {
      // Cache miss or error, proceed to function
    }
  }

  const result = await fn();

  if (redis) {
    try {
      await redis.setex(key, ttlSeconds, JSON.stringify(result));
    } catch {
      // Silently fail cache write
    }
  }

  return result;
}

/**
 * Invalidate cache key(s)
 */
export async function invalidateCache(pattern: string): Promise<void> {
  const redis = await getRedis();
  if (!redis) return;
  try {
    const keys = await redis.keys(pattern);
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  } catch {
    // Silently fail
  }
}

/**
 * Test Redis connection with given URL
 */
export async function testRedisConnection(url: string): Promise<{ success: boolean; error?: string; latency?: number }> {
  let testClient: Redis | null = null;
  try {
    const start = Date.now();
    testClient = new Redis(url, {
      connectTimeout: 5000,
      maxRetriesPerRequest: 1,
      lazyConnect: true,
    });
    await testClient.connect();
    await testClient.ping();
    const latency = Date.now() - start;
    return { success: true, latency };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Connection failed' };
  } finally {
    if (testClient) {
      testClient.disconnect();
    }
  }
}
