import { runtimeStateStore } from "@/lib/enterprise/runtime-state";
import { redis } from "@/lib/redis";
import { InMemoryMemoryProvider, type MemoryProvider, type MemoryQuery, type MemoryRecord } from "../../packages/agent-sdk/src/memory";

export class RedisMemoryAdapter implements MemoryProvider {
  private readonly fallback = new InMemoryMemoryProvider();
  private readonly redisEnabled = Boolean(process.env.REDIS_URL);

  async get(query: MemoryQuery): Promise<MemoryRecord | undefined> {
    const key = this.key(query);
    if (!this.redisEnabled) return this.fallback.get(query);
    try {
      const raw = await redis.get(key);
      if (!raw) return this.fallback.get(query);
      return JSON.parse(raw) as MemoryRecord;
    } catch {
      return this.fallback.get(query);
    }
  }

  async set(record: MemoryRecord): Promise<void> {
    await this.fallback.set(record);
    if (!this.redisEnabled) return;
    try {
      const ttlSeconds = record.expiresAt
        ? Math.max(1, Math.floor((Date.parse(record.expiresAt) - Date.now()) / 1000))
        : 86_400;
      await redis.set(this.key(record), JSON.stringify(record), "EX", ttlSeconds);
    } catch {
      // Fallback only.
    }
  }

  async delete(query: MemoryQuery): Promise<boolean> {
    const deleted = await this.fallback.delete(query);
    if (!this.redisEnabled) return deleted;
    try {
      await redis.del(this.key(query));
    } catch {
      // Fallback only.
    }
    return deleted;
  }

  async search(query: MemoryQuery): Promise<MemoryRecord[]> {
    return this.fallback.search(query);
  }

  async clear(scope: Pick<MemoryQuery, "tenantId" | "agentId" | "sessionId">): Promise<void> {
    await this.fallback.clear(scope);
  }

  private key(record: Pick<MemoryQuery, "tenantId" | "agentId" | "sessionId" | "key" | "tier">): string {
    return ["agentfusion-memory", record.tenantId ?? "shared", record.agentId ?? "shared", record.sessionId ?? "global", record.tier ?? "short-term", record.key ?? "all"].join(":");
  }
}

export class SupabaseMemoryAdapter implements MemoryProvider {
  private readonly fallback = new InMemoryMemoryProvider();

  async get(query: MemoryQuery): Promise<MemoryRecord | undefined> {
    return this.fallback.get(query);
  }

  async set(record: MemoryRecord): Promise<void> {
    await this.fallback.set(record);
    try {
      await runtimeStateStore.save("workflows", {
        id: this.recordId(record),
        tenant_id: record.tenantId,
        payload: {
          kind: "agentfusion-memory",
          record,
        },
      });
    } catch {
      // Fallback only.
    }
  }

  async delete(query: MemoryQuery): Promise<boolean> {
    return this.fallback.delete(query);
  }

  async search(query: MemoryQuery): Promise<MemoryRecord[]> {
    return this.fallback.search(query);
  }

  async clear(scope: Pick<MemoryQuery, "tenantId" | "agentId" | "sessionId">): Promise<void> {
    await this.fallback.clear(scope);
  }

  private recordId(record: Pick<MemoryRecord, "tenantId" | "agentId" | "sessionId" | "tier" | "key">): string {
    return [record.tenantId, record.agentId ?? "shared", record.sessionId ?? "global", record.tier, record.key].join(":");
  }
}

export class AgentMemoryRuntime {
  readonly shortTerm = new RedisMemoryAdapter();
  readonly longTerm = new SupabaseMemoryAdapter();

  async writeExecutionContext(record: Omit<MemoryRecord, "tier">): Promise<void> {
    await this.shortTerm.set({ ...record, tier: "short-term" });
  }

  async writeWorkflowState(record: Omit<MemoryRecord, "tier">): Promise<void> {
    await this.shortTerm.set({ ...record, tier: "short-term" });
  }

  async writeTenantKnowledge(record: Omit<MemoryRecord, "tier">): Promise<void> {
    await this.longTerm.set({ ...record, tier: "long-term" });
  }

  async writeAgentHistory(record: Omit<MemoryRecord, "tier">): Promise<void> {
    await this.longTerm.set({ ...record, tier: "long-term" });
  }

  async writePreferences(record: Omit<MemoryRecord, "tier">): Promise<void> {
    await this.longTerm.set({ ...record, tier: "long-term" });
  }
}
