import Redis from "ioredis";

// ---------------------------------------------------------------------------
// Client singleton
// ---------------------------------------------------------------------------

let _redis: Redis | null = null;

function getRedis(): Redis {
  if (_redis) return _redis;

  const url = process.env.REDIS_URL;
  if (!url) {
    console.warn("[redis] REDIS_URL is not configured. Redis features will be unavailable.");
  }

  _redis = new Redis(url ?? "redis://localhost:6379", {
    maxRetriesPerRequest: null,
    enableOfflineQueue: true,
    lazyConnect: true,
    retryStrategy: (times) => {
      const delay = Math.min(1000 * 2 ** times, 30_000);
      return delay;
    },
  });

  _redis.on("error", (err: Error) => {
    console.error("[redis] Connection error", err.message);
  });

  _redis.on("connect", () => {
    console.info("[redis] Connected");
  });

  _redis.on("reconnecting", () => {
    console.info("[redis] Reconnecting…");
  });

  return _redis;
}

export const redis = new Proxy({} as Redis, {
  get(_target, prop) {
    return getRedis()[prop as keyof Redis];
  },
});

// ---------------------------------------------------------------------------
// Cache helpers
// ---------------------------------------------------------------------------

/**
 * Fetch a cached value or compute it on miss.
 * @param key   Cache key
 * @param ttlSeconds  Time-to-live in seconds
 * @param compute  Async function that produces the value on cache miss
 */
export async function cached<T>(
  key: string,
  ttlSeconds: number,
  compute: () => Promise<T>,
): Promise<T> {
  const client = getRedis();
  const raw = await client.get(key).catch(() => null);
  if (raw !== null) {
    try {
      return JSON.parse(raw) as T;
    } catch (err) {
      console.warn("[redis] cache parse failed, treating as miss", (err as Error).message);
      await client
        .del(key)
        .catch((delErr: Error) =>
          console.warn("[redis] failed to delete corrupted cache key", delErr.message),
        );
    }
  }
  const value = await compute();
  await client
    .set(key, JSON.stringify(value), "EX", ttlSeconds)
    .catch((err: Error) => console.warn("[redis] cache set failed", err.message));
  return value;
}

/**
 * Invalidate a cache key.
 */
export async function invalidate(key: string): Promise<void> {
  await getRedis()
    .del(key)
    .catch((err: Error) => console.warn("[redis] cache invalidate failed", err.message));
}

// ---------------------------------------------------------------------------
// Distributed lock helpers (SET … NX EX pattern)
// ---------------------------------------------------------------------------

const LOCK_PREFIX = "lock:";
const DEFAULT_LOCK_TTL_MS = 10_000;

/**
 * Acquire a distributed lock. Returns a release function, or null if the lock
 * could not be acquired.
 */
export async function acquireLock(
  resource: string,
  ttlMs: number = DEFAULT_LOCK_TTL_MS,
): Promise<(() => Promise<void>) | null> {
  const client = getRedis();
  const key = `${LOCK_PREFIX}${resource}`;
  const token = `${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const acquired = await client
    .set(key, token, "PX", ttlMs, "NX")
    .catch(() => null);
  if (!acquired) return null;

  return async () => {
    // Only delete the key if we still own it (Lua for atomicity)
    const script = `
      if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("del", KEYS[1])
      else
        return 0
      end
    `;
    await client.eval(script, 1, key, token).catch((err: Error) => {
      console.warn("[redis] lock release failed", err.message);
    });
  };
}

// ---------------------------------------------------------------------------
// Pub/Sub helpers
// ---------------------------------------------------------------------------

type SubscriberCallback = (channel: string, message: string) => void;

/**
 * Subscribe to one or more Redis channels. Returns an unsubscribe function.
 * Each call creates a dedicated subscriber connection so the main client is
 * not blocked in subscriber mode.
 */
export function subscribePubSub(
  channels: string[],
  callback: SubscriberCallback,
): () => Promise<void> {
  const url = process.env.REDIS_URL ?? "redis://localhost:6379";
  const subscriber = new Redis(url, { lazyConnect: true, maxRetriesPerRequest: null });

  subscriber.on("message", callback);
  subscriber
    .subscribe(...channels)
    .catch((err: Error) => console.error("[redis] subscribe failed", err.message));

  return async () => {
    await subscriber.unsubscribe(...channels).catch(() => undefined);
    subscriber.disconnect();
  };
}

export { getRedis };
