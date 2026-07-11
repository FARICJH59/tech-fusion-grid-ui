import { redis } from "@/lib/redis";
import type { AutonomousEvent, DeadLetterRecord } from "@/lib/events/event-types";
import { autonomousEventBus } from "@/lib/events/event-bus";

export type ProcessorResult = {
  processed: number;
  retried: number;
  deadLettered: number;
};

export type EventHandler = (event: AutonomousEvent) => Promise<void>;

const GROUP_PREFIX = "phase85:group";
const CONSUMER_PREFIX = "phase85:consumer";
const MAX_ATTEMPTS = 3;
const REDIS_ENABLED = Boolean(process.env.REDIS_URL);

export class StreamProcessor {
  private readonly handlers = new Map<AutonomousEvent["type"], EventHandler>();

  constructor(private readonly bus = autonomousEventBus) {}

  register(type: AutonomousEvent["type"], handler: EventHandler): void {
    this.handlers.set(type, handler);
  }

  async ensureConsumerGroup(streamName: string, groupName: string): Promise<void> {
    if (!REDIS_ENABLED) return;
    await redis
      .xgroup("CREATE", streamName, `${GROUP_PREFIX}:${groupName}`, "$", "MKSTREAM")
      .catch(() => undefined);
  }

  async processBatch(events: AutonomousEvent[], consumerGroup = "ops"): Promise<ProcessorResult> {
    let processed = 0;
    let retried = 0;
    let deadLettered = 0;

    await this.ensureConsumerGroup("phase85:autonomous-events", consumerGroup);

    for (const event of events) {
      const handler = this.handlers.get(event.type);
      if (!handler) continue;

      try {
        await handler(event);
        processed += 1;
      } catch (error) {
        const attempts = (event.attempts ?? 0) + 1;
        if (attempts >= MAX_ATTEMPTS) {
          const dlq: DeadLetterRecord = {
            event: { ...event, attempts },
            failedAt: new Date().toISOString(),
            reason: error instanceof Error ? error.message : "unknown failure",
          };
          await this.bus.deadLetter(dlq);
          deadLettered += 1;
          continue;
        }

        await this.bus.publish({
          ...event,
          attempts,
          dedupeKey: `${event.id}:retry:${attempts}`,
        });
        retried += 1;
      }

      if (REDIS_ENABLED) {
        await redis
          .set(`${CONSUMER_PREFIX}:${consumerGroup}:${event.id}`, new Date().toISOString(), "EX", 3600)
          .catch(() => undefined);
      }
    }

    return { processed, retried, deadLettered };
  }
}

export const streamProcessor = new StreamProcessor();
