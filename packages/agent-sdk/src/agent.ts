import type { CapabilityDefinition } from "./capability";
import type { AgentExecutionContext } from "./context";
import type { AgentEvaluationProfile } from "./evaluation";
import type { MemoryContract } from "./memory";
import type { AgentPermission } from "./permission";
import type { ToolReference } from "./tool";
import type { WorkflowDefinition } from "./workflow";

export type AgentIdentity = {
  id: string;
  name: string;
  version: string;
  description: string;
};

export type AgentPurpose = {
  mission: string;
  domain: string;
  objectives: string[];
};

export type AgentCapabilities = {
  supportedActions: string[];
  supportedTools: string[];
  registered: CapabilityDefinition[];
  supportedWorkflows: string[];
};

export type Agent = {
  identity: AgentIdentity;
  purpose: AgentPurpose;
  capabilities: AgentCapabilities;
  tools: ToolReference[];
  memory: MemoryContract;
  permissions: AgentPermission[];
  workflows: WorkflowDefinition[];
  evaluation: AgentEvaluationProfile;
  defaultContext?: Partial<AgentExecutionContext>;
  metadata?: Record<string, unknown>;
};

export type AgentValidationResult = {
  valid: boolean;
  errors: string[];
};

export class AgentRegistry {
  private readonly agents = new Map<string, Agent>();

  register(agent: Agent): AgentValidationResult {
    const validation = this.validate(agent);
    if (!validation.valid) {
      throw new Error(validation.errors.join("; "));
    }

    this.agents.set(this.toStorageKey(agent.identity.id, agent.identity.version), agent);
    return validation;
  }

  get(agentId: string, version?: string): Agent | undefined {
    if (version) {
      return this.agents.get(this.toStorageKey(agentId, version));
    }

    return [...this.agents.values()]
      .filter((agent) => agent.identity.id === agentId)
      .sort((left, right) => right.identity.version.localeCompare(left.identity.version, undefined, { numeric: true }))[0];
  }

  list(): Agent[] {
    return [...this.agents.values()];
  }

  discoverByDomain(domain: string): Agent[] {
    return this.list().filter((agent) => agent.purpose.domain === domain);
  }

  validate(agent: Agent): AgentValidationResult {
    const errors: string[] = [];

    if (!agent.identity.id || !agent.identity.name || !agent.identity.version || !agent.identity.description) {
      errors.push("Agent identity must include id, name, version, and description.");
    }

    if (!agent.purpose.mission || !agent.purpose.domain || agent.purpose.objectives.length === 0) {
      errors.push("Agent purpose must define mission, domain, and objectives.");
    }

    if (agent.capabilities.registered.length === 0) {
      errors.push("Agent must register at least one capability.");
    }

    if (!agent.memory.storageAdapter || agent.memory.namespaces.length === 0) {
      errors.push("Agent memory contract must define a storage adapter and namespaces.");
    }

    if (agent.permissions.length === 0) {
      errors.push("Agent must define at least one permission contract.");
    }

    if (agent.workflows.length === 0) {
      errors.push("Agent must define at least one workflow.");
    }

    if (agent.evaluation.tests.length === 0 || agent.evaluation.metrics.length === 0) {
      errors.push("Agent evaluation contract must include tests and metrics.");
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  private toStorageKey(agentId: string, version: string): string {
    return `${agentId}@${version}`;
  }
}
