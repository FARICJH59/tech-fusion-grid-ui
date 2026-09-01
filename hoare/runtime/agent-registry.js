'use strict';

class AgentRegistry {
  constructor() { this.agents = new Map(); }

  register(manifest, handler) {
    if (!manifest || !manifest.id) throw new Error('AGENT_MANIFEST_REQUIRED');
    if (typeof handler !== 'function') throw new Error('AGENT_HANDLER_REQUIRED');
    this.agents.set(manifest.id, { manifest, handler, registered_at: new Date().toISOString() });
    return manifest;
  }

  unregister(id) { return this.agents.delete(id); }
  get(id) { return this.agents.get(id) || null; }
  has(id) { return this.agents.has(id); }

  list() {
    return [...this.agents.values()].map(({ manifest, registered_at }) => ({ ...manifest, registered_at }));
  }

  findByCapability(capability) {
    return this.list().filter(agent => agent.capabilities.includes(capability));
  }

  async execute(id, context, input) {
    const entry = this.get(id);
    if (!entry) throw new Error(`AGENT_NOT_FOUND: ${id}`);
    return entry.handler({ context, input, manifest: entry.manifest });
  }
}

module.exports = { AgentRegistry };
