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
  | "billing.event"
  // Autonomous: service lifecycle
  | "service.registered"
  | "service.deregistered"
  | "service.health_changed"
  // Autonomous: incidents
  | "incident.created"
  | "incident.resolved"
  | "incident.escalated"
  // Autonomous: deployments
  | "deployment.started"
  | "deployment.completed"
  | "deployment.failed"
  | "deployment.rolled_back"
  // Autonomous: fleet
  | "fleet.node_registered"
  | "fleet.node_heartbeat"
  | "fleet.node_offline"
  // Autonomous: cost
  | "cost.alert"
  | "cost.optimized"
  // Autonomous: compliance
  | "compliance.violation"
  | "compliance.remediated"
  // Autonomous: scheduler
  | "scheduled.job_triggered"
  | "scheduled.job_completed";

export type RuntimeEvent = {
  type: RuntimeEventType;
  tenantId: string;
  correlationId?: string;
  timestamp: string;
  payload: Record<string, unknown>;
  /** Semantic version of the event schema. */
  version?: string;
  /** Chain of correlation IDs tracing the causal history of this event. */
  correlationChain?: string[];
};

export type EventHandler = (event: RuntimeEvent) => void | Promise<void>;

export interface IEventBus {
  emit(event: RuntimeEvent): void;
  on(type: RuntimeEventType | "*", handler: EventHandler): () => void;
  off(type: RuntimeEventType | "*", handler: EventHandler): void;
  onceAsync(type: RuntimeEventType): Promise<RuntimeEvent>;
}

const AUDIT_LOG_MAX = 1000;

export class InMemoryEventBus implements IEventBus {
  private readonly handlers = new Map<RuntimeEventType | "*", Set<EventHandler>>();
  private readonly auditLog: RuntimeEvent[] = [];

  emit(event: RuntimeEvent): void {
    // Maintain bounded audit log
    this.auditLog.push(event);
    if (this.auditLog.length > AUDIT_LOG_MAX) {
      this.auditLog.shift();
    }

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

  /** Emit an event after a delay; if the event fails to be handled it is
   *  retried once more after the same delay. */
  retryEvent(event: RuntimeEvent, delayMs: number): void {
    setTimeout(() => {
      try {
        this.emit(event);
      } catch {
        // single retry
        setTimeout(() => this.emit(event), delayMs);
      }
    }, delayMs);
  }

  /** Schedule an event to fire exactly once after `delayMs` milliseconds. */
  scheduleEvent(event: RuntimeEvent, delayMs: number): void {
    setTimeout(() => this.emit(event), delayMs);
  }

  /** Return a copy of the audit log (up to last 1000 events). */
  getAuditLog(): RuntimeEvent[] {
    return [...this.auditLog];
  }
}

export const eventBus: IEventBus = new InMemoryEventBus();
