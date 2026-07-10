/**
 * Dead-letter event foundation.
 *
 * When event processing fails after all retry attempts, the event is written
 * to a Redis dead-letter store instead of being silently dropped.  Events
 * can be inspected, replayed, or purged by operators via the DLQ API.
 *
 * Falls back gracefully (logs a warning and discards) when Redis is not
 * configured — acceptable for local development but a production blocker.
 *
 * Usage:
 *   import { deadLetter } from "@/lib/utils/dead-letter";
 *
 *   try {
 *     await processEvent(event);
 *   } catch (err) {
 *     await deadLetter({
 *       queue: "execution-plane",
 *       tenantId: event.tenantId,
 *       payload: event,
 *       error: err,
 *       source: "mqtt-handler",
 *     });
 *   }
 */

export type DeadLetterEntry<T = unknown> = {
  /** Logical queue / category for the event (e.g. "execution-plane", "telemetry"). */
  queue: string;
  /** Tenant that owns this event. */
  tenantId: string;
  /** Original event payload. */
  payload: T;
  /** Error that caused the event to be dead-lettered. */
  error: unknown;
  /** Handler or subsystem that originally attempted to process the event. */
  source: string;
  /** ISO-8601 timestamp; defaults to now. */
  timestamp?: string;
  /** Idempotency key, if any was present on the original request. */
  idempotencyKey?: string;
};

type StoredDeadLetterEntry<T = unknown> = DeadLetterEntry<T> & {
  id: string;
  timestamp: string;
  errorMessage: string;
};

const KEY_PREFIX = "dlq:";
/** Maximum number of entries kept per queue (per tenant). Oldest are evicted. */
const MAX_ENTRIES_PER_QUEUE = 1_000;
/** TTL for each DLQ entry: 7 days.  Allows operator review before expiry. */
const TTL_SECONDS = 60 * 60 * 24 * 7;

/**
 * Write a failed event to the dead-letter queue.
 *
 * On Redis unavailability the error is logged and the function resolves
 * without throwing — the caller's error handling is unaffected.
 */
export async function deadLetter<T = unknown>(
  entry: DeadLetterEntry<T>,
): Promise<void> {
  if (!process.env.REDIS_URL) {
    console.warn(
      "[dlq] Redis not configured — dead-lettered event will be discarded",
      {
        queue: entry.queue,
        tenantId: entry.tenantId,
        source: entry.source,
        error: entry.error instanceof Error ? entry.error.message : String(entry.error),
      },
    );
    return;
  }

  try {
    const { getRedis } = await import("@/lib/redis");
    const client = getRedis();

    const stored: StoredDeadLetterEntry<T> = {
      ...entry,
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      timestamp: entry.timestamp ?? new Date().toISOString(),
      errorMessage: entry.error instanceof Error ? entry.error.message : String(entry.error),
    };

    const listKey = `${KEY_PREFIX}${entry.queue}:${entry.tenantId}`;
    const entryJson = JSON.stringify(stored);

    // LPUSH + LTRIM keeps the list bounded (newest first).
    // Each entry is also stored individually with a TTL so it expires cleanly.
    const pipeline = client.pipeline();
    pipeline.lpush(listKey, entryJson);
    pipeline.ltrim(listKey, 0, MAX_ENTRIES_PER_QUEUE - 1);
    pipeline.expire(listKey, TTL_SECONDS);
    await pipeline.exec();

    console.warn("[dlq] Event dead-lettered", {
      queue: entry.queue,
      tenantId: entry.tenantId,
      source: entry.source,
      id: stored.id,
      error: stored.errorMessage,
    });
  } catch (redisErr) {
    // DLQ write failures must never propagate — the caller already failed once.
    console.error("[dlq] Failed to write dead-letter entry to Redis", {
      queue: entry.queue,
      source: entry.source,
      error: redisErr instanceof Error ? redisErr.message : String(redisErr),
    });
  }
}

/**
 * Read up to `limit` dead-letter entries for a queue / tenant.
 * Returns entries newest-first.
 */
export async function readDeadLetters<T = unknown>(
  queue: string,
  tenantId: string,
  limit = 100,
): Promise<StoredDeadLetterEntry<T>[]> {
  if (!process.env.REDIS_URL) return [];

  try {
    const { getRedis } = await import("@/lib/redis");
    const client = getRedis();
    const listKey = `${KEY_PREFIX}${queue}:${tenantId}`;
    const raw = await client.lrange(listKey, 0, limit - 1);
    return raw.map((s) => JSON.parse(s) as StoredDeadLetterEntry<T>);
  } catch {
    return [];
  }
}

/**
 * Remove all dead-letter entries for a queue / tenant.
 * Typically called after an operator has reviewed and replayed the events.
 */
export async function purgeDeadLetters(
  queue: string,
  tenantId: string,
): Promise<void> {
  if (!process.env.REDIS_URL) return;

  try {
    const { getRedis } = await import("@/lib/redis");
    const client = getRedis();
    await client.del(`${KEY_PREFIX}${queue}:${tenantId}`);
  } catch {
    // Best-effort
  }
}
