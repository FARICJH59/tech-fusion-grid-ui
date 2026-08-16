import crypto from 'node:crypto';

export function createPlatformCore({ tenantStore = new Map() } = {}) {
  return {
    health() {
      return { service: 'TechFusion Platform Core', status: 'ONLINE', runtime: 'owned', timestamp: new Date().toISOString() };
    },
    identity() {
      return { provider: 'techfusion', controlPlane: 'owned', tenantIsolation: true };
    },
    createTenant(name) {
      if (!name || !/^[a-zA-Z0-9][a-zA-Z0-9._-]{1,62}$/.test(name)) throw new Error('Invalid tenant name');
      const tenant = { tenantId: name, runtimeId: crypto.randomUUID(), status: 'ACTIVE', created: new Date().toISOString() };
      tenantStore.set(name, tenant);
      return tenant;
    },
    getTenant(id) { return tenantStore.get(id) ?? null; },
    listTenants() { return [...tenantStore.values()]; }
  };
}
