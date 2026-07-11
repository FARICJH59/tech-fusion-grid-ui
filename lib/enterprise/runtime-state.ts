import { redis } from "@/lib/redis";
import { supabase } from "@/lib/supabase";

export const RUNTIME_STATE_ENTITIES = [
  "organizations",
  "tenants",
  "agents",
  "workflows",
  "incidents",
  "fleet",
  "deployments",
  "policies",
] as const;

export const REDIS_RUNTIME_CAPABILITIES = [
  "distributed-locks",
  "queues",
  "scheduler",
  "replay-queues",
  "idempotency",
  "cache",
  "runtime-coordination",
] as const;

type RuntimeEntity = (typeof RUNTIME_STATE_ENTITIES)[number];

export type RuntimeRecord = {
  id: string;
  tenant_id: string;
  payload: Record<string, unknown>;
  created_at?: string;
  updated_at?: string;
};

export class RuntimeStateStore {
  async save(entity: RuntimeEntity, record: RuntimeRecord): Promise<void> {
    const table = `phase7_${entity}`;
    await supabase.from(table).upsert(record).throwOnError();
  }

  async list(entity: RuntimeEntity, tenantId: string): Promise<RuntimeRecord[]> {
    const table = `phase7_${entity}`;
    const { data, error } = await supabase
      .from(table)
      .select("id, tenant_id, payload, created_at, updated_at")
      .eq("tenant_id", tenantId)
      .order("updated_at", { ascending: false })
      .limit(100);

    if (error) throw error;
    return (data ?? []) as RuntimeRecord[];
  }
}

export class RuntimeRedisCoordinator {
  async enqueue(queue: string, payload: Record<string, unknown>): Promise<void> {
    await redis.lpush(`phase7:queue:${queue}`, JSON.stringify(payload));
  }

  async dequeue(queue: string): Promise<Record<string, unknown> | null> {
    const raw = await redis.rpop(`phase7:queue:${queue}`);
    if (!raw) return null;
    return JSON.parse(raw) as Record<string, unknown>;
  }

  async setIdempotency(key: string, ttlSeconds: number): Promise<boolean> {
    const result = await redis.set(`phase7:idempotency:${key}`, "1", "EX", ttlSeconds, "NX");
    return result === "OK";
  }

  async schedule(jobKey: string, executeAtUnixSeconds: number): Promise<void> {
    await redis.zadd("phase7:scheduler", executeAtUnixSeconds, jobKey);
  }

  async dueJobs(unixNow: number): Promise<string[]> {
    return redis.zrangebyscore("phase7:scheduler", 0, unixNow);
  }

  async replay(queue: string, payload: Record<string, unknown>): Promise<void> {
    await redis.lpush(`phase7:replay:${queue}`, JSON.stringify(payload));
  }

  async cacheSet(key: string, value: unknown, ttlSeconds: number): Promise<void> {
    await redis.set(`phase7:cache:${key}`, JSON.stringify(value), "EX", ttlSeconds);
  }

  async cacheGet<T>(key: string): Promise<T | null> {
    const value = await redis.get(`phase7:cache:${key}`);
    if (!value) return null;
    return JSON.parse(value) as T;
  }
}

export const runtimeStateStore = new RuntimeStateStore();
export const runtimeRedisCoordinator = new RuntimeRedisCoordinator();
