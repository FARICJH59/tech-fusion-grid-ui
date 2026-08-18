export interface ExecutionLease {
  key: string;
  owner: string;
  expiresAt: number;
}

export interface ExecutionCoordinator {
  acquire(key: string, owner: string, ttlMs: number): Promise<ExecutionLease | null>;
  release(key: string, owner: string): Promise<void>;
}

export class InMemoryExecutionCoordinator implements ExecutionCoordinator {
  private readonly leases = new Map<string, ExecutionLease>();

  async acquire(key: string, owner: string, ttlMs: number): Promise<ExecutionLease | null> {
    const now = Date.now();
    const existing = this.leases.get(key);
    if (existing && existing.expiresAt > now && existing.owner !== owner) return null;
    const lease = { key, owner, expiresAt: now + ttlMs };
    this.leases.set(key, lease);
    return lease;
  }

  async release(key: string, owner: string): Promise<void> {
    const existing = this.leases.get(key);
    if (existing?.owner === owner) this.leases.delete(key);
  }
}

export function executionKey(tenantId: string, targetId: string, actionId: string): string {
  if (!tenantId || !targetId || !actionId) throw new Error("EXECUTION_KEY_INCOMPLETE");
  return `${tenantId}:${targetId}:${actionId}`;
}
