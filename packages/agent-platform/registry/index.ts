import { AgentManifest } from "../types";

const registry = new Map<string, AgentManifest>();

export function registerAgent(agent: AgentManifest) {
  registry.set(agent.id, agent);
  return agent;
}

export function getAgent(id: string) {
  return registry.get(id);
}

export function listAgents() {
  return Array.from(registry.values());
}
