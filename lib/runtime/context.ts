import type { Role } from "@/lib/auth";
import { logger, getTracer } from "@/lib/telemetry/otel";
import type { RuntimeEvent } from "@/lib/runtime/event-bus";
import type {
  AgentDefinition,
  ToolDefinition,
  WorkflowDefinition,
} from "@/lib/runtime/types";

export type RuntimeContext = {
  tenantId: string;
  correlationId: string;
  logger: typeof logger;
  tracer: ReturnType<typeof getTracer>;
  getAgent: (id: string) => AgentDefinition | undefined;
  getTool: (id: string, version?: string) => ToolDefinition | undefined;
  getWorkflow: (id: string) => WorkflowDefinition | undefined;
  emit: (event: RuntimeEvent) => void;
};

export type TenantContext = {
  tenantId: string;
  userId: string;
  role: Role;
  correlationId: string;
};

export function createRuntimeContext(
  tenantId: string,
  correlationId: string,
  overrides: Partial<RuntimeContext> = {},
): RuntimeContext {
  return {
    tenantId,
    correlationId,
    logger,
    tracer: getTracer(),
    getAgent: () => undefined,
    getTool: () => undefined,
    getWorkflow: () => undefined,
    emit: () => undefined,
    ...overrides,
  };
}
