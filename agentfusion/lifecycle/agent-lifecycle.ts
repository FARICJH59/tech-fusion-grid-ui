import type { Agent } from "../../packages/agent-sdk/src/agent";
import type { AgentExecutionContext } from "../../packages/agent-sdk/src/context";
import { AgentAuthorizationError, AgentValidationError } from "../runtime/agent-errors";
import { AGENT_RUNTIME_EVENT_NAMES, AgentRuntimeEventBus } from "../runtime/agent-events";
import { AgentFusionRegistry, type AgentLifecycleState, type AgentRegistryRecord } from "../registry/agent-registry";
import { AgentSecurityRuntime } from "../security/security-runtime";

const ALLOWED_TRANSITIONS: Record<AgentLifecycleState, AgentLifecycleState[]> = {
  REGISTERED: ["VALIDATED", "DISABLED", "RETIRED"],
  VALIDATED: ["ACTIVE", "DISABLED", "RETIRED"],
  ACTIVE: ["PAUSED", "UPDATING", "DISABLED", "RETIRED"],
  PAUSED: ["ACTIVE", "DISABLED", "RETIRED"],
  UPDATING: ["VALIDATED", "DISABLED", "RETIRED"],
  DISABLED: ["RETIRED"],
  RETIRED: [],
};

export class AgentLifecycleManager {
  constructor(
    private readonly registry = new AgentFusionRegistry(),
    private readonly security = new AgentSecurityRuntime(),
    private readonly events = new AgentRuntimeEventBus(),
  ) {}

  async registerAgent(agent: Agent, tenantId: string, context: AgentExecutionContext): Promise<AgentRegistryRecord> {
    await this.authorize(agent.identity.id, tenantId, "register-agent", context, "admin");
    const validation = this.registry.validate(agent);
    if (!validation.valid) {
      throw new AgentValidationError(validation.errors.join("; "));
    }

    const record = await this.registry.register({ tenantId, agent, status: "REGISTERED" });
    await this.events.emit(AGENT_RUNTIME_EVENT_NAMES.AgentRegistered, {
      agentId: agent.identity.id,
      tenantId,
      correlationId: context.correlationId,
      payload: { version: agent.identity.version, status: record.status },
    });
    return record;
  }

  async validateAgent(agentId: string, tenantId: string, context: AgentExecutionContext, version?: string) {
    await this.authorize(agentId, tenantId, "validate-agent", context, "operator");
    return this.transition(agentId, tenantId, "VALIDATED", context, version);
  }

  async activateAgent(agentId: string, tenantId: string, context: AgentExecutionContext, version?: string) {
    const record = await this.transition(agentId, tenantId, "ACTIVE", context, version);
    await this.events.emit(AGENT_RUNTIME_EVENT_NAMES.AgentActivated, {
      agentId,
      tenantId,
      correlationId: context.correlationId,
      payload: { version: record.version },
    });
    return record;
  }

  async pauseAgent(agentId: string, tenantId: string, context: AgentExecutionContext, version?: string) {
    return this.transition(agentId, tenantId, "PAUSED", context, version);
  }

  async updateAgent(
    agentId: string,
    tenantId: string,
    metadata: Record<string, unknown>,
    context: AgentExecutionContext,
    version?: string,
  ) {
    await this.authorize(agentId, tenantId, "update-agent", context, "admin");
    await this.transition(agentId, tenantId, "UPDATING", context, version);
    return this.registry.updateMetadata(tenantId, agentId, metadata, version);
  }

  async disableAgent(agentId: string, tenantId: string, context: AgentExecutionContext, version?: string) {
    const record = await this.transition(agentId, tenantId, "DISABLED", context, version);
    await this.events.emit(AGENT_RUNTIME_EVENT_NAMES.AgentDisabled, {
      agentId,
      tenantId,
      correlationId: context.correlationId,
      payload: { version: record.version },
    });
    return record;
  }

  async retireAgent(agentId: string, tenantId: string, context: AgentExecutionContext, version?: string) {
    return this.transition(agentId, tenantId, "RETIRED", context, version);
  }

  private async transition(
    agentId: string,
    tenantId: string,
    next: AgentLifecycleState,
    context: AgentExecutionContext,
    version?: string,
  ) {
    await this.authorize(agentId, tenantId, `lifecycle:${next.toLowerCase()}`, context, "operator");
    const current = this.registry.getRecord(tenantId, agentId, version);
    if (!current) {
      throw new AgentValidationError(`Unknown agent '${agentId}'.`);
    }

    if (!ALLOWED_TRANSITIONS[current.status].includes(next)) {
      throw new AgentValidationError(`Invalid lifecycle transition ${current.status} -> ${next}.`);
    }

    return this.registry.setStatus(tenantId, agentId, next, current.version);
  }

  private async authorize(
    agentId: string,
    tenantId: string,
    action: string,
    context: AgentExecutionContext,
    requiredRole: "viewer" | "operator" | "admin" | "service",
  ) {
    const result = await this.security.authorize({
      agentId,
      tenantId,
      action,
      resource: "agent-lifecycle",
      context,
      requiredRole,
      attributes: { scope: "admin" },
    });
    if (!result.allowed && !result.approvalRequired) {
      throw new AgentAuthorizationError(result.reason);
    }
  }
}
