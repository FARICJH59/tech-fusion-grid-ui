import type { AgentRole } from "./permission";

export type TenantScope = {
  tenantId: string;
  organizationId?: string;
  workspaceId?: string;
  environment?: string;
  crossTenant?: boolean;
};

export type AgentActor = {
  id: string;
  role: AgentRole;
  type: "user" | "service" | "agent";
  displayName?: string;
};

export type AgentBudget = {
  maxCostUsd?: number;
  maxLatencyMs?: number;
};

export type AgentExecutionContext = {
  requestId: string;
  sessionId?: string;
  correlationId?: string;
  tenant: TenantScope;
  actor: AgentActor;
  budget?: AgentBudget;
  metadata?: Record<string, unknown>;
};
