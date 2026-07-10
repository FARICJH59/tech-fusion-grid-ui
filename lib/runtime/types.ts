import type { RetryOptions } from "@/lib/utils/retry";

export type AgentId = string;
export type AgentStatus = "idle" | "running" | "stopped" | "error";

export type AgentDefinition = {
  id: AgentId;
  name: string;
  version: string;
  description: string;
  capabilities: string[];
  tenantId?: string;
  execute: (input: AgentInput, ctx: RuntimeContext) => Promise<AgentOutput>;
};

export type AgentInput = {
  task: string;
  parameters?: Record<string, unknown>;
  context?: Record<string, unknown>;
  idempotencyKey?: string;
};

export type AgentOutput = {
  result: unknown;
  metadata?: Record<string, unknown>;
};

export type ToolId = string;
export type ToolVersion = string;

export type ToolDefinition<TInput = unknown, TOutput = unknown> = {
  id: ToolId;
  version: ToolVersion;
  name: string;
  description: string;
  inputSchema?: Record<string, unknown>;
  execute: (input: TInput, ctx: RuntimeContext) => Promise<TOutput>;
};

export type WorkflowId = string;
export type WorkflowStepId = string;
export type WorkflowStatus = "pending" | "running" | "completed" | "failed" | "cancelled" | "timeout";

export type WorkflowStep = {
  id: WorkflowStepId;
  name: string;
  toolId: ToolId;
  toolVersion?: ToolVersion;
  input?: Record<string, unknown>;
  retryOptions?: RetryOptions;
  timeoutMs?: number;
  onError?: "stop" | "continue" | "dead-letter";
};

export type WorkflowDefinition = {
  id: WorkflowId;
  name: string;
  version: string;
  description?: string;
  steps: WorkflowStep[];
  tenantId?: string;
};

export type WorkflowRun = {
  runId: string;
  workflowId: WorkflowId;
  tenantId: string;
  status: WorkflowStatus;
  startedAt: string;
  completedAt?: string;
  steps: WorkflowStepRun[];
  idempotencyKey?: string;
};

export type WorkflowStepRun = {
  stepId: WorkflowStepId;
  status: WorkflowStatus;
  startedAt: string;
  completedAt?: string;
  output?: unknown;
  error?: string;
};

export type ExecutionId = string;
export type ExecutionStatus = "queued" | "running" | "completed" | "failed" | "cancelled" | "timeout";

export type ExecutionRequest = {
  id?: ExecutionId;
  type: "agent" | "tool" | "workflow";
  targetId: string;
  targetVersion?: string;
  tenantId: string;
  input: unknown;
  idempotencyKey?: string;
  timeoutMs?: number;
  priority?: number;
  retries?: number;
};

export type ExecutionResult = {
  id: ExecutionId;
  status: ExecutionStatus;
  output?: unknown;
  error?: string;
  startedAt: string;
  completedAt?: string;
  durationMs?: number;
  attempts: number;
};

export type PluginId = string;

export type Plugin = {
  id: PluginId;
  name: string;
  version: string;
  initialize: (ctx: RuntimeContext) => Promise<void>;
  teardown?: () => Promise<void>;
};

export type { RetryOptions };
export type RuntimeContext = import("@/lib/runtime/context").RuntimeContext;
