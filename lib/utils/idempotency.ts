/**
 * Idempotency key support for execution-plane actions.
 *
 * Stores completed action results in Redis with a TTL so that replayed
 * requests with the same idempotency key return the cached response instead
 * of executing the action again.
 *
 * Falls back gracefully (executes without caching) when Redis is unavailable.
 *
 * Usage:
 *   const result = await withIdempotency(
 *     idempotencyKey,           // e.g. req.headers.get("idempotency-key")
 *     tenantId,
 *     async () => performAction(),
 *   );
 */

const KEY_PREFIX = "idempotency:";
// Default TTL: 24 hours — long enough to cover network retries
const DEFAULT_TTL_SECONDS = 60 * 60 * 24;

export type IdempotencyResult<T> = {
  /** The action result (from cache or fresh execution). */
  data: T;
  /** True when the result was served from the idempotency cache. */
  replayed: boolean;
};

/**
 * Execute `action` exactly once for the given `idempotencyKey` within the
 * scope of `tenantId`.  Subsequent calls with the same key return the cached
 * result without re-executing the action.
 */
export async function withIdempotency<T>(
  idempotencyKey: string | null | undefined,
  tenantId: string,
  action: () => Promise<T>,
  ttlSeconds = DEFAULT_TTL_SECONDS,
): Promise<IdempotencyResult<T>> {
  // No key supplied → execute normally without caching
  if (!idempotencyKey) {
    return { data: await action(), replayed: false };
  }

  const storeKey = `${KEY_PREFIX}${tenantId}:${idempotencyKey}`;

  if (process.env.REDIS_URL) {
    try {
      const { getRedis } = await import("@/lib/redis");
      const client = getRedis();

      // Check for existing result
      const cached = await client.get(storeKey);
      if (cached !== null) {
        try {
          return { data: JSON.parse(cached) as T, replayed: true };
        } catch {
          // Cached value is unparseable (e.g. schema migration) — re-execute
          console.warn(`[idempotency] Failed to parse cached result for key ${storeKey}, re-executing`);
        }
      }

      // Execute and cache the result
      const data = await action();
      await client.set(storeKey, JSON.stringify(data), "EX", ttlSeconds);
      return { data, replayed: false };
    } catch {
      // Redis unavailable — fall through to execute without caching
    }
  }

  return { data: await action(), replayed: false };
}

/**
 * Extract the idempotency key from a Next.js Request headers object.
 * Returns null when the header is absent.
 */
export function extractIdempotencyKey(headers: { get(key: string): string | null }): string | null {
  return headers.get("idempotency-key") ?? headers.get("x-idempotency-key");
}
