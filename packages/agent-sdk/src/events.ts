export const AGENT_EVENT_TYPES = [
  "workflow.started",
  "workflow.step.completed",
  "workflow.awaiting-approval",
  "tool.invoked",
  "memory.read",
  "memory.write",
  "permission.evaluated",
  "evaluation.completed",
] as const;

export type AgentEventType = (typeof AGENT_EVENT_TYPES)[number];

export type AgentEvent<T extends Record<string, unknown> = Record<string, unknown>> = {
  id: string;
  agentId: string;
  type: AgentEventType;
  timestamp: string;
  payload: T;
  correlationId?: string;
};

export type AgentEventSubscriber = (event: AgentEvent) => void | Promise<void>;

export class AgentEventBus {
  private readonly subscribers = new Set<AgentEventSubscriber>();

  subscribe(subscriber: AgentEventSubscriber): () => void {
    this.subscribers.add(subscriber);
    return () => this.subscribers.delete(subscriber);
  }

  async emit(event: AgentEvent): Promise<void> {
    await Promise.all([...this.subscribers].map((subscriber) => subscriber(event)));
  }
}
