export class DeploymentAdapter {
  constructor(name) { this.name = name; }
  async deploy() { throw new Error(`${this.name}: deploy() not implemented`); }
  async status() { return { adapter: this.name, status: 'UNKNOWN' }; }
  async destroy() { throw new Error(`${this.name}: destroy() not implemented`); }
}

export function createAdapterRegistry() {
  const adapters = new Map();
  return {
    register(adapter) { if (!adapter?.name) throw new Error('Adapter name required'); adapters.set(adapter.name, adapter); },
    get(name) { return adapters.get(name); },
    list() { return [...adapters.keys()]; }
  };
}
