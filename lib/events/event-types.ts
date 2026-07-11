export const AUTONOMOUS_EVENT_TYPES = [
  "cloud-action",
  "deployment",
  "approval",
  "scaling",
  "rollback",
  "incident",
  "slo-breach",
  "recovery",
  "operator-override",
  "operations-snapshot",
  "agent-registered",
  "agent-activated",
  "agent-execution-started",
  "agent-execution-completed",
  "agent-execution-failed",
  "agent-approval-required",
  "agent-disabled",
] as const;

export type AutonomousEventType = (typeof AUTONOMOUS_EVENT_TYPES)[number];

export type EventPriority = "low" | "medium" | "high" | "critical";

export type AutonomousEvent<T extends Record<string, unknown> = Record<string, unknown>> = {
  id: string;
  tenantId: string;
  organizationId: string;
  type: AutonomousEventType;
  source: string;
  priority: EventPriority;
  timestamp: string;
  correlationId?: string;
  dedupeKey?: string;
  payload: T;
  attempts?: number;
};

export type EventReplayRequest = {
  tenantId: string;
  organizationId: string;
  fromTimestamp?: string;
  toTimestamp?: string;
  types?: AutonomousEventType[];
  limit?: number;
};

export type DeadLetterRecord = {
  event: AutonomousEvent;
  failedAt: string;
  reason: string;
};
