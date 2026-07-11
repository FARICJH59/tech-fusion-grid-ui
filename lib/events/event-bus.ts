import { redis } from "@/lib/redis";
import type { AutonomousEvent, DeadLetterRecord, EventReplayRequest } from "@/lib/events/event-types";

type Subscriber = (event: AutonomousEvent) => void | Promise<void>;

const STREAM_NAME = "phase85:autonomous-events";
const DEAD_LETTER_STREAM = "phase85:autonomous-events:dlq";
const IDEMPOTENCY_PREFIX = "phase85:idempotency";
const MAX_REPLAY_BUFFER = 2_000;
const DEFAULT_IDEMPOTENCY_TTL_SECONDS = 60 * 60;

export class AutonomousEventBus {
  private readonly streamName: string;
  private readonly deadLetterStream: string;
  private readonly replayBuffer: AutonomousEvent[] = [];
  private readonly subscribers = new Set<Subscriber>();

  constructor(streamName = STREAM_NAME, deadLetterStream = DEAD_LETTER_STREAM) {
    this.streamName = streamName;
    this.deadLetterStream = deadLetterStream;
  }

  async publish(event: AutonomousEvent): Promise<boolean> {
    const idempotencyKey = `${IDEMPOTENCY_PREFIX}:${event.dedupeKey ?? event.id}`;
    const idempotent = await this.markIdempotent(idempotencyKey);
    if (!idempotent) return false;

    const prepared: AutonomousEvent = {
      ...event,
      attempts: event.attempts ?? 0,
    };

    this.replayBuffer.unshift(prepared);
    if (this.replayBuffer.length > MAX_REPLAY_BUFFER) this.replayBuffer.length = MAX_REPLAY_BUFFER;

    await redis
      .xadd(this.streamName, "*", "event", JSON.stringify(prepared))
      .catch(() => undefined);

    await Promise.all(
      [...this.subscribers].map(async (subscriber) => {
        await subscriber(prepared);
      }),
    );

    return true;
  }

  subscribe(subscriber: Subscriber): () => void {
    this.subscribers.add(subscriber);
    return () => this.subscribers.delete(subscriber);
  }

  async replay(request: EventReplayRequest): Promise<AutonomousEvent[]> {
    const types = request.types ? new Set(request.types) : null;
    const from = request.fromTimestamp ? Date.parse(request.fromTimestamp) : Number.NEGATIVE_INFINITY;
    const to = request.toTimestamp ? Date.parse(request.toTimestamp) : Number.POSITIVE_INFINITY;
    const limit = request.limit ?? 100;

    return this.replayBuffer
      .filter((event) => event.tenantId === request.tenantId)
      .filter((event) => event.organizationId === request.organizationId)
      .filter((event) => Date.parse(event.timestamp) >= from && Date.parse(event.timestamp) <= to)
      .filter((event) => (types ? types.has(event.type) : true))
      .slice(0, Math.max(0, limit));
  }

  async deadLetter(record: DeadLetterRecord): Promise<void> {
    await redis
      .xadd(this.deadLetterStream, "*", "event", JSON.stringify(record))
      .catch(() => undefined);
  }

  getReplayBufferSize(): number {
    return this.replayBuffer.length;
  }

  private async markIdempotent(key: string): Promise<boolean> {
    const result = await redis
      .set(key, "1", "EX", DEFAULT_IDEMPOTENCY_TTL_SECONDS, "NX")
      .catch(() => null);

    if (result === "OK") return true;

    // Redis unavailable: retain autonomous operation while keeping local dedupe
    if (result === null) {
      if (this.replayBuffer.some((event) => `${IDEMPOTENCY_PREFIX}:${event.dedupeKey ?? event.id}` === key)) {
        return false;
      }
      return true;
    }

    return false;
  }
}

export const autonomousEventBus = new AutonomousEventBus();
