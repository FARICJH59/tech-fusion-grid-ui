import { logger } from "@/lib/telemetry/otel";

export type RuntimeEventType =
  | "execution.started"
  | "execution.completed"
  | "execution.failed"
  | "workflow.completed"
  | "agent.registered"
  | "agent.deregistered"
  | "tool.executed"
  | "telemetry.received"
  | "audit.event"
  | "billing.event";

export type RuntimeEvent = {
  type: RuntimeEventType;
  tenantId: string;
  correlationId?: string;
  timestamp: string;
  payload: Record<string, unknown>;
};

export type EventHandler = (event: RuntimeEvent) => void | Promise<void>;

export interface IEventBus {
  emit(event: RuntimeEvent): void;
  on(type: RuntimeEventType | "*", handler: EventHandler): () => void;
  off(type: RuntimeEventType | "*", handler: EventHandler): void;
  onceAsync(type: RuntimeEventType): Promise<RuntimeEvent>;
}

export class InMemoryEventBus implements IEventBus {
  private readonly handlers = new Map<RuntimeEventType | "*", Set<EventHandler>>();

  emit(event: RuntimeEvent): void {
    const directHandlers = this.handlers.get(event.type) ?? new Set<EventHandler>();
    const wildcardHandlers = this.handlers.get("*") ?? new Set<EventHandler>();

    for (const handler of [...directHandlers, ...wildcardHandlers]) {
      try {
        const result = handler(event);
        if (result instanceof Promise) {
          void result.catch((error: unknown) => {
            logger.error("[runtime/event-bus] Async handler failed", {
              type: event.type,
              error: error instanceof Error ? error.message : String(error),
            });
          });
        }
      } catch (error) {
        logger.error("[runtime/event-bus] Handler failed", {
          type: event.type,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  on(type: RuntimeEventType | "*", handler: EventHandler): () => void {
    const bucket = this.handlers.get(type) ?? new Set<EventHandler>();
    bucket.add(handler);
    this.handlers.set(type, bucket);
    return () => this.off(type, handler);
  }

  off(type: RuntimeEventType | "*", handler: EventHandler): void {
    const bucket = this.handlers.get(type);
    if (!bucket) {
      return;
    }
    bucket.delete(handler);
    if (bucket.size === 0) {
      this.handlers.delete(type);
    }
  }

  onceAsync(type: RuntimeEventType): Promise<RuntimeEvent> {
    return new Promise<RuntimeEvent>((resolve) => {
      const unsubscribe = this.on(type, (event) => {
        unsubscribe();
        resolve(event);
      });
    });
  }
}

export const eventBus: IEventBus = new InMemoryEventBus();
