import { AgentRegistry as SdkAgentRegistry, type Agent } from "../../packages/agent-sdk/src/agent";
import { runtimeStateStore } from "@/lib/enterprise/runtime-state";

export const AGENT_LIFECYCLE_STATES = [
  "REGISTERED",
  "VALIDATED",
  "ACTIVE",
  "PAUSED",
  "UPDATING",
  "DISABLED",
  "RETIRED",
] as const;

export type AgentLifecycleState = (typeof AGENT_LIFECYCLE_STATES)[number];

export type AgentRegistryRecord = {
  agentId: string;
  tenantId: string;
  name: string;
  version: string;
  domain: string;
  capabilities: string[];
  permissions: string[];
  status: AgentLifecycleState;
  createdAt: string;
  updatedAt: string;
  metadata?: Record<string, unknown>;
};

export type AgentRegistrationRequest = {
  tenantId: string;
  agent: Agent;
  status?: AgentLifecycleState;
  metadata?: Record<string, unknown>;
};

export class AgentFusionRegistry {
  private readonly sdkRegistry = new SdkAgentRegistry();
  private readonly agents = new Map<string, Agent>();
  private readonly records = new Map<string, AgentRegistryRecord>();

  async register(request: AgentRegistrationRequest): Promise<AgentRegistryRecord> {
    const validation = this.sdkRegistry.validate(request.agent);
    if (!validation.valid) {
      throw new Error(validation.errors.join("; "));
    }

    const now = new Date().toISOString();
    const record: AgentRegistryRecord = {
      agentId: request.agent.identity.id,
      tenantId: request.tenantId,
      name: request.agent.identity.name,
      version: request.agent.identity.version,
      domain: request.agent.purpose.domain,
      capabilities: request.agent.capabilities.registered.map((capability) => capability.id),
      permissions: request.agent.permissions.map((permission) => permission.id),
      status: request.status ?? "REGISTERED",
      createdAt: now,
      updatedAt: now,
      metadata: request.metadata,
    };

    this.agents.set(this.key(request.tenantId, request.agent.identity.id, request.agent.identity.version), request.agent);
    this.records.set(this.key(request.tenantId, request.agent.identity.id, request.agent.identity.version), record);
    await this.persist(record);
    return record;
  }

  getAgent(tenantId: string, agentId: string, version?: string): Agent | undefined {
    const resolved = this.getRecord(tenantId, agentId, version);
    if (!resolved) return undefined;
    return this.agents.get(this.key(tenantId, agentId, resolved.version));
  }

  getRecord(tenantId: string, agentId: string, version?: string): AgentRegistryRecord | undefined {
    if (version) return this.records.get(this.key(tenantId, agentId, version));

    return this.list(tenantId)
      .filter((record) => record.agentId === agentId)
      .sort((left, right) => right.version.localeCompare(left.version, undefined, { numeric: true }))[0];
  }

  list(tenantId?: string): AgentRegistryRecord[] {
    const records = [...this.records.values()];
    return tenantId ? records.filter((record) => record.tenantId === tenantId) : records;
  }

  discover(criteria: {
    tenantId?: string;
    domain?: string;
    capability?: string;
    status?: AgentLifecycleState;
  }): AgentRegistryRecord[] {
    return this.list(criteria.tenantId)
      .filter((record) => (criteria.domain ? record.domain === criteria.domain : true))
      .filter((record) => (criteria.capability ? record.capabilities.includes(criteria.capability) : true))
      .filter((record) => (criteria.status ? record.status === criteria.status : true));
  }

  listVersions(tenantId: string, agentId: string): string[] {
    return this.list(tenantId)
      .filter((record) => record.agentId === agentId)
      .map((record) => record.version)
      .sort((left, right) => right.localeCompare(left, undefined, { numeric: true }));
  }

  lookupCapabilities(tenantId: string, agentId: string, version?: string): string[] {
    return this.getRecord(tenantId, agentId, version)?.capabilities ?? [];
  }

  async setStatus(tenantId: string, agentId: string, status: AgentLifecycleState, version?: string): Promise<AgentRegistryRecord> {
    const current = this.getRecord(tenantId, agentId, version);
    if (!current) {
      throw new Error(`Unknown agent '${agentId}'.`);
    }

    const updated: AgentRegistryRecord = {
      ...current,
      status,
      updatedAt: new Date().toISOString(),
    };
    this.records.set(this.key(tenantId, agentId, updated.version), updated);
    await this.persist(updated);
    return updated;
  }

  async updateMetadata(
    tenantId: string,
    agentId: string,
    metadata: Record<string, unknown>,
    version?: string,
  ): Promise<AgentRegistryRecord> {
    const current = this.getRecord(tenantId, agentId, version);
    if (!current) {
      throw new Error(`Unknown agent '${agentId}'.`);
    }

    const updated: AgentRegistryRecord = {
      ...current,
      metadata: { ...(current.metadata ?? {}), ...metadata },
      updatedAt: new Date().toISOString(),
    };
    this.records.set(this.key(tenantId, agentId, updated.version), updated);
    await this.persist(updated);
    return updated;
  }

  validate(agent: Agent) {
    return this.sdkRegistry.validate(agent);
  }

  private key(tenantId: string, agentId: string, version: string): string {
    return `${tenantId}:${agentId}@${version}`;
  }

  private async persist(record: AgentRegistryRecord): Promise<void> {
    try {
      await runtimeStateStore.save("agents", {
        id: `${record.agentId}@${record.version}`,
        tenant_id: record.tenantId,
        payload: {
          kind: "agentfusion-registry-record",
          ...record,
        },
      });
    } catch {
      // Best-effort persistence for local and CI environments.
    }
  }
}
