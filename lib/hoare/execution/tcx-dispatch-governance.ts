import { getRedis } from "@/lib/redis";
import { validateTcxLease, type TcxLease } from "./tcx-governance";

export type { TcxLease } from "./tcx-governance";
export type TcxDispatchIntentStatus = "PENDING" | "CLAIMED" | "PUBLISHED";
export type TcxDispatchIntent = {
  dispatchKey: string;
  transactionId: string;
  attemptId: string;
  attemptNumber: number;
  stateVersion: number;
  idempotencyKey: string;
  channelId?: string;
  status: TcxDispatchIntentStatus;
  createdAt: string;
  claimedAt?: string;
  claimExpiresAt?: string;
  publishedAt?: string;
};

export interface TcxLeaseRepository {
  get(leaseId: string): Promise<TcxLease | null>;
  put(lease: TcxLease): Promise<TcxLease>;
  revoke(leaseId: string, revokedAt?: string): Promise<TcxLease>;
}

export class InMemoryTcxLeaseRepository implements TcxLeaseRepository {
  private readonly leases = new Map<string, TcxLease>();
  async get(id: string) { const value = this.leases.get(id); return value ? structuredClone(value) : null; }
  async put(value: TcxLease) {
    if (this.leases.has(value.leaseId)) throw new Error("tcx_lease_already_exists");
    this.leases.set(value.leaseId, structuredClone(value));
    return structuredClone(value);
  }
  async revoke(id: string, revokedAt = new Date().toISOString()) {
    const value = this.leases.get(id);
    if (!value) throw new Error("tcx_lease_not_found");
    const revoked = { ...value, revokedAt };
    this.leases.set(id, revoked);
    return structuredClone(revoked);
  }
}

const LEASE_KEY_PREFIX = "hoare:tcx:lease";
const DISPATCH_INTENT_KEY_PREFIX = "hoare:tcx:dispatch-intent";
const CLAIM_TTL_MS = 30_000;

function safeKey(prefix: string, id: string): string {
  if (!id || id.includes("\u0000")) throw new Error("tcx_governance_invalid_key");
  return `${prefix}:${id}`;
}

export class RedisTcxLeaseRepository implements TcxLeaseRepository {
  async get(id: string) {
    const raw = await getRedis().get(safeKey(LEASE_KEY_PREFIX, id));
    if (raw === null) return null;
    try { return JSON.parse(raw) as TcxLease; }
    catch (error) { throw new Error("tcx_lease_corrupt", { cause: error }); }
  }
  async put(value: TcxLease) {
    const result = await getRedis().set(safeKey(LEASE_KEY_PREFIX, value.leaseId), JSON.stringify(value), "NX");
    if (result !== "OK") throw new Error("tcx_lease_already_exists");
    return structuredClone(value);
  }
  async revoke(id: string, revokedAt = new Date().toISOString()) {
    const key = safeKey(LEASE_KEY_PREFIX, id);
    const client = getRedis();
    await client.watch(key);
    try {
      const raw = await client.get(key);
      if (raw === null) throw new Error("tcx_lease_not_found");
      const value = JSON.parse(raw) as TcxLease;
      const revoked = { ...value, revokedAt };
      const result = await client.multi().set(key, JSON.stringify(revoked)).exec();
      if (result === null) throw new Error("tcx_lease_version_conflict");
      return structuredClone(revoked);
    } catch (error) {
      await client.unwatch().catch(() => undefined);
      throw error;
    }
  }
}

export function buildTcxDispatchKey(transactionId: string, attemptId: string): string {
  if (!transactionId || !attemptId) throw new Error("tcx_dispatch_identity_invalid");
  return `${transactionId}:${attemptId}`;
}

export async function requireValidTcxLease(
  transaction: { leaseId?: string | null; transactionId: string; attemptId: string },
  leases: TcxLeaseRepository,
  now = new Date(),
): Promise<TcxLease> {
  if (!transaction.leaseId) throw new Error("tcx_lease_required");
  const lease = await leases.get(transaction.leaseId);
  if (!lease) throw new Error("tcx_lease_not_found");
  validateTcxLease(transaction, lease, now);
  return lease;
}

export interface TcxDispatchIntentRepository {
  get(dispatchKey: string): Promise<TcxDispatchIntent | null>;
  create(intent: TcxDispatchIntent): Promise<TcxDispatchIntent>;
  claim(dispatchKey: string, now?: string): Promise<TcxDispatchIntent>;
  markPublished(dispatchKey: string, now?: string): Promise<TcxDispatchIntent>;
}

function claimRecord(value: TcxDispatchIntent, now: string): TcxDispatchIntent {
  return { ...value, status: "CLAIMED", claimedAt: now, claimExpiresAt: new Date(Date.parse(now) + CLAIM_TTL_MS).toISOString() };
}

export class InMemoryTcxDispatchIntentRepository implements TcxDispatchIntentRepository {
  private readonly intents = new Map<string, TcxDispatchIntent>();
  async get(key: string) { const value = this.intents.get(key); return value ? structuredClone(value) : null; }
  async create(value: TcxDispatchIntent) {
    const existing = this.intents.get(value.dispatchKey);
    if (existing) return structuredClone(existing);
    this.intents.set(value.dispatchKey, structuredClone(value));
    return structuredClone(value);
  }
  async claim(key: string, now = new Date().toISOString()) {
    const current = this.intents.get(key);
    if (!current) throw new Error("tcx_dispatch_intent_not_found");
    if (current.status === "PUBLISHED") return structuredClone(current);
    if (current.status === "CLAIMED" && current.claimExpiresAt && Date.parse(current.claimExpiresAt) > Date.parse(now)) throw new Error("tcx_dispatch_intent_claimed");
    const claimed = claimRecord(current, now);
    this.intents.set(key, claimed);
    return structuredClone(claimed);
  }
  async markPublished(key: string, now = new Date().toISOString()) {
    const current = this.intents.get(key);
    if (!current) throw new Error("tcx_dispatch_intent_not_found");
    if (current.status === "PUBLISHED") return structuredClone(current);
    const published = { ...current, status: "PUBLISHED" as const, publishedAt: now };
    this.intents.set(key, published);
    return structuredClone(published);
  }
}

export class RedisTcxDispatchIntentRepository implements TcxDispatchIntentRepository {
  async get(key: string) {
    const raw = await getRedis().get(safeKey(DISPATCH_INTENT_KEY_PREFIX, key));
    if (raw === null) return null;
    try { return JSON.parse(raw) as TcxDispatchIntent; }
    catch (error) { throw new Error("tcx_dispatch_intent_corrupt", { cause: error }); }
  }
  async create(value: TcxDispatchIntent) {
    const key = safeKey(DISPATCH_INTENT_KEY_PREFIX, value.dispatchKey);
    const result = await getRedis().set(key, JSON.stringify(value), "NX");
    if (result === "OK") return structuredClone(value);
    const existing = await this.get(value.dispatchKey);
    if (!existing) throw new Error("tcx_dispatch_intent_create_conflict");
    return existing;
  }
  async claim(key: string, now = new Date().toISOString()) {
    const redisKey = safeKey(DISPATCH_INTENT_KEY_PREFIX, key);
    const client = getRedis();
    await client.watch(redisKey);
    try {
      const raw = await client.get(redisKey);
      if (raw === null) throw new Error("tcx_dispatch_intent_not_found");
      const current = JSON.parse(raw) as TcxDispatchIntent;
      if (current.status === "PUBLISHED") return current;
      if (current.status === "CLAIMED" && current.claimExpiresAt && Date.parse(current.claimExpiresAt) > Date.parse(now)) throw new Error("tcx_dispatch_intent_claimed");
      const claimed = claimRecord(current, now);
      const result = await client.multi().set(redisKey, JSON.stringify(claimed)).exec();
      if (result === null) throw new Error("tcx_dispatch_intent_claim_conflict");
      return structuredClone(claimed);
    } catch (error) {
      await client.unwatch().catch(() => undefined);
      throw error;
    }
  }
  async markPublished(key: string, now = new Date().toISOString()) {
    const redisKey = safeKey(DISPATCH_INTENT_KEY_PREFIX, key);
    const client = getRedis();
    await client.watch(redisKey);
    try {
      const raw = await client.get(redisKey);
      if (raw === null) throw new Error("tcx_dispatch_intent_not_found");
      const current = JSON.parse(raw) as TcxDispatchIntent;
      if (current.status === "PUBLISHED") return current;
      const published = { ...current, status: "PUBLISHED" as const, publishedAt: now };
      const result = await client.multi().set(redisKey, JSON.stringify(published)).exec();
      if (result === null) throw new Error("tcx_dispatch_intent_version_conflict");
      return structuredClone(published);
    } catch (error) {
      await client.unwatch().catch(() => undefined);
      throw error;
    }
  }
}
