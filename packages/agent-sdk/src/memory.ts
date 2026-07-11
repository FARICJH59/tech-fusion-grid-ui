export type MemoryTier = "short-term" | "long-term";
export type RequiredMemoryType = MemoryTier | "hybrid";
export type RetentionStrategy = "session" | "ttl" | "persistent" | "archival";

export type MemoryRetentionPolicy = {
  strategy: RetentionStrategy;
  ttlSeconds?: number;
  maxEntries?: number;
  archiveAfterDays?: number;
};

export type MemoryContract = {
  requiredMemoryType: RequiredMemoryType;
  storageAdapter: string;
  retentionPolicy: MemoryRetentionPolicy;
  namespaces: string[];
};

export type MemoryRecord = {
  key: string;
  value: unknown;
  tier: MemoryTier;
  tenantId: string;
  agentId?: string;
  sessionId?: string;
  tags?: string[];
  updatedAt: string;
  expiresAt?: string;
};

export type MemoryQuery = {
  key?: string;
  tenantId?: string;
  agentId?: string;
  sessionId?: string;
  tier?: MemoryTier;
  tags?: string[];
};

export interface MemoryProvider {
  get(query: MemoryQuery): Promise<MemoryRecord | undefined>;
  set(record: MemoryRecord): Promise<void>;
  delete(query: MemoryQuery): Promise<boolean>;
  search(query: MemoryQuery): Promise<MemoryRecord[]>;
  clear(scope: Pick<MemoryQuery, "tenantId" | "agentId" | "sessionId">): Promise<void>;
}

export class InMemoryMemoryProvider implements MemoryProvider {
  private readonly records = new Map<string, MemoryRecord>();

  async get(query: MemoryQuery): Promise<MemoryRecord | undefined> {
    return this.find(query)[0];
  }

  async set(record: MemoryRecord): Promise<void> {
    this.records.set(this.toStorageKey(record), record);
    this.enforceRetention(record);
  }

  async delete(query: MemoryQuery): Promise<boolean> {
    const matches = this.find(query);
    matches.forEach((record) => this.records.delete(this.toStorageKey(record)));
    return matches.length > 0;
  }

  async search(query: MemoryQuery): Promise<MemoryRecord[]> {
    return this.find(query);
  }

  async clear(scope: Pick<MemoryQuery, "tenantId" | "agentId" | "sessionId">): Promise<void> {
    const matches = this.find(scope);
    matches.forEach((record) => this.records.delete(this.toStorageKey(record)));
  }

  private find(query: MemoryQuery): MemoryRecord[] {
    const now = Date.now();
    const matches = [...this.records.values()]
      .filter((record) => !record.expiresAt || Date.parse(record.expiresAt) > now)
      .filter((record) => (query.key ? record.key === query.key : true))
      .filter((record) => (query.tenantId ? record.tenantId === query.tenantId : true))
      .filter((record) => (query.agentId ? record.agentId === query.agentId : true))
      .filter((record) => (query.sessionId ? record.sessionId === query.sessionId : true))
      .filter((record) => (query.tier ? record.tier === query.tier : true))
      .filter((record) =>
        query.tags && query.tags.length > 0
          ? query.tags.every((tag) => record.tags?.includes(tag))
          : true,
      )
      .sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt));

    return matches;
  }

  private enforceRetention(record: MemoryRecord): void {
    if (!record.agentId) return;

    const matches = this.find({ tenantId: record.tenantId, agentId: record.agentId, tier: record.tier });
    const maxEntries = matches[0]?.tags?.includes("pinned")
      ? undefined
      : record.tier === "short-term"
        ? 100
        : undefined;

    if (maxEntries && matches.length > maxEntries) {
      matches.slice(maxEntries).forEach((entry) => this.records.delete(this.toStorageKey(entry)));
    }
  }

  private toStorageKey(record: Pick<MemoryRecord, "tenantId" | "agentId" | "sessionId" | "key" | "tier">): string {
    return [record.tenantId, record.agentId ?? "shared", record.sessionId ?? "global", record.tier, record.key].join(":");
  }
}
