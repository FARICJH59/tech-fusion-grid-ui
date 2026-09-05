import os from "node:os";
import { redis } from "@/lib/redis";
import type { AutonomousEvent, DeadLetterRecord } from "@/lib/events/event-types";
import { autonomousEventBus } from "@/lib/events/event-bus";

export type ProcessorResult = { processed: number; retried: number; deadLettered: number };
export type EventHandler = (event: AutonomousEvent) => Promise<void>;
type RedisStreamEntry = [string, string[]];
type RedisStream = [string, RedisStreamEntry[]];

const STREAM_NAME = "phase85:autonomous-events";
const DEAD_LETTER_STREAM = "phase85:autonomous-events:dlq";
const GROUP_PREFIX = "phase85:group";
const CONSUMER_PREFIX = "phase85:consumer";
const MAX_ATTEMPTS = 3;
const DEFAULT_COUNT = 20;
const DEFAULT_BLOCK_MS = 5_000;
const DEFAULT_CLAIM_IDLE_MS = 30_000;

function redisEnabled(): boolean { return Boolean(process.env.REDIS_URL); }
function groupKey(groupName: string): string { return `${GROUP_PREFIX}:${groupName}`; }
function defaultConsumerId(): string {
  return `${CONSUMER_PREFIX}:${os.hostname()}:${process.pid}:${Math.random().toString(36).slice(2, 10)}`;
}

function parseEvent(entry: RedisStreamEntry): AutonomousEvent {
  const [, fields] = entry;
  const index = fields.indexOf("event");
  if (index < 0 || !fields[index + 1]) throw new Error("invalid_autonomous_event_stream_entry");
  const event = JSON.parse(fields[index + 1]) as AutonomousEvent;
  if (!event.id || !event.type || !event.tenantId || !event.organizationId) {
    throw new Error("invalid_autonomous_event_payload");
  }
  return event;
}

export class StreamProcessor {
  private readonly handlers = new Map<AutonomousEvent["type"], EventHandler>();
  private running = false;
  private loopPromise: Promise<void> | null = null;

  constructor(private readonly bus = autonomousEventBus) {}

  register(type: AutonomousEvent["type"], handler: EventHandler): void { this.handlers.set(type, handler); }

  async ensureConsumerGroup(streamName = STREAM_NAME, consumerGroup = "ops"): Promise<void> {
    if (!redisEnabled()) return;
    try {
      await redis.xgroup("CREATE", streamName, groupKey(consumerGroup), "$", "MKSTREAM");
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (!message.includes("BUSYGROUP")) throw error;
    }
  }

  async processBatch(events: AutonomousEvent[], consumerGroup = "ops"): Promise<ProcessorResult> {
    let processed = 0, retried = 0, deadLettered = 0;
    for (const event of events) {
      const result = await this.processEvent(event, consumerGroup);
      processed += result.processed; retried += result.retried; deadLettered += result.deadLettered;
    }
    return { processed, retried, deadLettered };
  }

  async start(options: {
    streamName?: string; consumerGroup?: string; consumerId?: string;
    count?: number; blockMs?: number; claimIdleMs?: number;
  } = {}): Promise<void> {
    if (!redisEnabled() || this.running) return;
    const streamName = options.streamName ?? STREAM_NAME;
    const consumerGroup = options.consumerGroup ?? "ops";
    const consumerId = options.consumerId ?? defaultConsumerId();
    const count = options.count ?? DEFAULT_COUNT;
    const blockMs = options.blockMs ?? DEFAULT_BLOCK_MS;
    const claimIdleMs = options.claimIdleMs ?? DEFAULT_CLAIM_IDLE_MS;
    await this.ensureConsumerGroup(streamName, consumerGroup);
    this.running = true;
    this.loopPromise = this.consumeLoop(streamName, consumerGroup, consumerId, count, blockMs, claimIdleMs);
  }

  async stop(): Promise<void> {
    this.running = false;
    if (this.loopPromise) await this.loopPromise;
    this.loopPromise = null;
  }

  isRunning(): boolean { return this.running; }

  private async consumeLoop(
    streamName: string, consumerGroup: string, consumerId: string,
    count: number, blockMs: number, claimIdleMs: number,
  ): Promise<void> {
    await this.recoverPending(streamName, consumerGroup, consumerId, count, claimIdleMs);
    while (this.running) {
      try {
        const response = (await redis.xreadgroup(
          "GROUP", groupKey(consumerGroup), consumerId, "COUNT", count,
          "BLOCK", blockMs, "STREAMS", streamName, ">",
        )) as RedisStream[] | null;
        if (!response) continue;
        for (const [, entries] of response) {
          for (const entry of entries) await this.processStreamEntry(entry, streamName, consumerGroup);
        }
      } catch (error) {
        if (!this.running) break;
        console.error("[stream-processor] consumer loop failure", error);
        await new Promise((resolve) => setTimeout(resolve, 1_000));
      }
    }
  }

  private async recoverPending(
    streamName: string, consumerGroup: string, consumerId: string,
    count: number, claimIdleMs: number,
  ): Promise<void> {
    let cursor = "0-0";
    do {
      const result = (await redis.xautoclaim(
        streamName, groupKey(consumerGroup), consumerId, claimIdleMs, cursor, "COUNT", count,
      )) as [string, RedisStreamEntry[], string[]];
      cursor = result?.[0] ?? "0-0";
      for (const entry of result?.[1] ?? []) {
        await this.processStreamEntry(entry, streamName, consumerGroup);
      }
    } while (cursor !== "0-0" && this.running);
  }

  private async processStreamEntry(entry: RedisStreamEntry, streamName: string, consumerGroup: string): Promise<void> {
    const messageId = entry[0];
    try {
      await this.processEvent(parseEvent(entry), consumerGroup);
    } catch (error) {
      const reason = error instanceof Error ? error.message : "unknown failure";
      const malformed: DeadLetterRecord = {
        event: {
          id: messageId, tenantId: "unknown", organizationId: "unknown", type: "incident",
          source: "stream-processor", priority: "critical", timestamp: new Date().toISOString(), payload: { messageId },
        },
        failedAt: new Date().toISOString(), reason,
      };
      await this.bus.deadLetter(malformed);
    } finally {
      await redis.xack(streamName, groupKey(consumerGroup), messageId);
    }
  }

  private async processEvent(event: AutonomousEvent, _consumerGroup: string): Promise<ProcessorResult> {
    const handler = this.handlers.get(event.type);
    if (!handler) return { processed: 0, retried: 0, deadLettered: 0 };
    try {
      await handler(event);
      return { processed: 1, retried: 0, deadLettered: 0 };
    } catch (error) {
      const attempts = (event.attempts ?? 0) + 1;
      if (attempts >= MAX_ATTEMPTS) {
        await this.bus.deadLetter({
          event: { ...event, attempts }, failedAt: new Date().toISOString(),
          reason: error instanceof Error ? error.message : "unknown failure",
        });
        return { processed: 0, retried: 0, deadLettered: 1 };
      }
      await this.bus.publish({ ...event, attempts, dedupeKey: `${event.id}:retry:${attempts}` });
      return { processed: 0, retried: 1, deadLettered: 0 };
    }
  }
}

export const streamProcessor = new StreamProcessor();
