import { autonomousEventBus } from "@/lib/events/event-bus";
import type { AutonomousEventType, EventPriority } from "@/lib/events/event-types";

export const AGENT_RUNTIME_EVENT_NAMES = {
  AgentRegistered: "AgentRegistered",
  AgentActivated: "AgentActivated",
  AgentExecutionStarted: "AgentExecutionStarted",
  AgentExecutionCompleted: "AgentExecutionCompleted",
  AgentExecutionFailed: "AgentExecutionFailed",
  AgentApprovalRequired: "AgentApprovalRequired",
  AgentDisabled: "AgentDisabled",
} as const;

export type AgentRuntimeEventName = (typeof AGENT_RUNTIME_EVENT_NAMES)[keyof typeof AGENT_RUNTIME_EVENT_NAMES];

export type AgentRuntimeEvent = {
  id: string;
  name: AgentRuntimeEventName;
  agentId: string;
  tenantId: string;
  timestamp: string;
  correlationId?: string;
  payload: Record<string, unknown>;
};

export type AgentRuntimeEventInput = {
  agentId: string;
  tenantId: string;
  correlationId?: string;
  payload: Record<string, unknown>;
};

const EVENT_TYPE_MAP: Record<AgentRuntimeEventName, AutonomousEventType> = {
  AgentRegistered: "agent-registered",
  AgentActivated: "agent-activated",
  AgentExecutionStarted: "agent-execution-started",
  AgentExecutionCompleted: "agent-execution-completed",
  AgentExecutionFailed: "agent-execution-failed",
  AgentApprovalRequired: "agent-approval-required",
  AgentDisabled: "agent-disabled",
};

const PRIORITY_MAP: Partial<Record<AgentRuntimeEventName, EventPriority>> = {
  AgentExecutionFailed: "high",
  AgentApprovalRequired: "high",
  AgentDisabled: "high",
};

export class AgentRuntimeEventBus {
  private readonly subscribers = new Set<(event: AgentRuntimeEvent) => void | Promise<void>>();
  private readonly history: AgentRuntimeEvent[] = [];

  subscribe(subscriber: (event: AgentRuntimeEvent) => void | Promise<void>): () => void {
    this.subscribers.add(subscriber);
    return () => this.subscribers.delete(subscriber);
  }

  async emit(name: AgentRuntimeEventName, input: AgentRuntimeEventInput): Promise<AgentRuntimeEvent> {
    const event: AgentRuntimeEvent = {
      id: `${input.agentId}:${name}:${Date.now().toString(36)}`,
      name,
      agentId: input.agentId,
      tenantId: input.tenantId,
      timestamp: new Date().toISOString(),
      correlationId: input.correlationId,
      payload: input.payload,
    };

    this.history.unshift(event);
    await Promise.all([...this.subscribers].map((subscriber) => subscriber(event)));
    await autonomousEventBus.publish({
      id: event.id,
      tenantId: event.tenantId,
      organizationId: event.tenantId,
      type: EVENT_TYPE_MAP[name],
      source: "agentfusion-runtime",
      priority: PRIORITY_MAP[name] ?? "medium",
      timestamp: event.timestamp,
      correlationId: event.correlationId,
      dedupeKey: `${event.name}:${event.agentId}:${event.timestamp}`,
      payload: {
        name: event.name,
        agentId: event.agentId,
        ...event.payload,
      },
    });
    return event;
  }

  list(agentId?: string): AgentRuntimeEvent[] {
    return agentId ? this.history.filter((event) => event.agentId === agentId) : [...this.history];
  }
}
