import type { AgentDefinition, AgentId } from "@/lib/runtime/types";

export class AgentRegistry {
  private readonly agents = new Map<AgentId, AgentDefinition>();

  register(def: AgentDefinition): void {
    if (this.agents.has(def.id)) {
      throw new Error(`Agent '${def.id}' is already registered`);
    }
    this.agents.set(def.id, def);
  }

  deregister(id: AgentId): boolean {
    return this.agents.delete(id);
  }

  get(id: AgentId): AgentDefinition | undefined {
    return this.agents.get(id);
  }

  list(tenantId?: string): AgentDefinition[] {
    const values = [...this.agents.values()];
    if (!tenantId) {
      return values;
    }
    return values.filter((agent) => agent.tenantId === undefined || agent.tenantId === tenantId);
  }

  count(): number {
    return this.agents.size;
  }
}
