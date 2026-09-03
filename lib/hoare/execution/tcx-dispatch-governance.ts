import { getRedis } from "@/lib/redis";
import { validateTcxLease, type TcxLease } from "./tcx-governance";

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
  publishedAt?: string;
};

export interface TcxLeaseRepository {
  get(leaseId: string): Promise<TcxLease | null>;
  put(lease: TcxLease): Promise<TcxLease>;
  revoke(leaseId: string, revokedAt?: string): Promise<TcxLease>;
}

export class InMemoryTcxLeaseRepository implements TcxLeaseRepository {
  private readonly leases = new Map<string, TcxLease>();
  async get(leaseId: string): Promise<TcxLease | null> { const lease = this.leases.get(leaseId); return lease ? structuredClone(lease) : null; }
  async put(lease: TcxLease): Promise<TcxLease> { if (this.leases.has(lease.leaseId)) throw new Error("tcx_lease_already_exists"); this.leases.set(lease.leaseId, structuredClone(lease)); return structuredClone(lease); }
  async revoke(leaseId: string, revokedAt = new Date().toISOString()): Promise<TcxLease> { const current = this.leases.get(leaseId); if (!current) throw new Error("tcx_lease_not_found"); const revoked = { ...current, revokedAt }; this.leases.set(leaseId, revoked); return structuredClone(revoked); }
}

const LEASE_KEY_PREFIX = "hoare:tcx:lease";
const DISPATCH_INTENT_KEY_PREFIX = "hoare:tcx:dispatch-intent";

function safeKey(prefix: string, id: string): string { if (!id || id.includes("\u0000")) throw new Error("tcx_governance_invalid_key"); return `${prefix}:${id}`; }

export class RedisTcxLeaseRepository implements TcxLeaseRepository {
  async get(leaseId: string): Promise<TcxLease | null> { const raw = await getRedis().get(safeKey(LEASE_KEY_PREFIX, leaseId)); if (raw === null) return null; try { return JSON.parse(raw) as TcxLease; } catch (error) { throw new Error("tcx_lease_corrupt", { cause: error }); } }
  async put(lease: TcxLease): Promise<TcxLease> { const result = await getRedis().set(safeKey(LEASE_KEY_PREFIX, lease.leaseId), JSON.stringify(lease), "NX"); if (result !== "OK") throw new Error("tcx_lease_already_exists"); return structuredClone(lease); }
  async revoke(leaseId: string, revokedAt = new Date().toISOString()): Promise<TcxLease> {
    const key = safeKey(LEASE_KEY_PREFIX, leaseId); const client = getRedis(); await client.watch(key);
    try { const raw = await client.get(key); if (raw === null) throw new Error("tcx_lease_not_found"); const revoked = { ...(JSON.parse(raw) as TcxLease), revokedAt }; const result = await client.multi().set(key, JSON.stringify(revoked)).exec(); if (result === null) throw new Error("tcx_lease_version_conflict"); return structuredClone(revoked); }
    catch (error) { await client.unwatch().catch(() => undefined); throw error; }
  }
}

export interface TcxDispatchIntentRepository {
  get(dispatchKey: string): Promise<TcxDispatchIntent | null>;
  create(intent: TcxDispatchIntent): Promise<TcxDispatchIntent>;
  claim(dispatchKey: string, claimedAt?: string): Promise<TcxDispatchIntent>;
  markPublished(dispatchKey: string, publishedAt?: string): Promise<TcxDispatchIntent>;
}

export class InMemoryTcxDispatchIntentRepository implements TcxDispatchIntentRepository {
  private readonly intents = new Map<string, TcxDispatchIntent>();
  async get(dispatchKey: string): Promise<TcxDispatchIntent | null> { const intent = this.intents.get(dispatchKey); return intent ? structuredClone(intent) : null; }
  async create(intent: TcxDispatchIntent): Promise<TcxDispatchIntent> { const current = this.intents.get(intent.dispatchKey); if (current) return structuredClone(current); this.intents.set(intent.dispatchKey, structuredClone(intent)); return structuredClone(intent); }
  async claim(dispatchKey: string, claimedAt = new Date().toISOString()): Promise<TcxDispatchIntent> { const current = this.intents.get(dispatchKey); if (!current) throw new Error("tcx_dispatch_intent_not_found"); if (current.status !== "PENDING") return structuredClone(current); const claimed = { ...current, status: "CLAIMED" as const, claimedAt }; this.intents.set(dispatchKey, claimed); return structuredClone(claimed); }
  async markPublished(dispatchKey: string, publishedAt = new Date().toISOString()): Promise<TcxDispatchIntent> { const current = this.intents.get(dispatchKey); if (!current) throw new Error("tcx_dispatch_intent_not_found"); if (current.status === "PUBLISHED") return structuredClone(current); const published = { ...current, status: "PUBLISHED" as const, publishedAt }; this.intents.set(dispatchKey, published); return structuredClone(published); }
}

export class RedisTcxDispatchIntentRepository implements TcxDispatchIntentRepository {
  async get(dispatchKey: string): Promise<TcxDispatchIntent | null> { const raw = await getRedis().get(safeKey(DISPATCH_INTENT_KEY_PREFIX, dispatchKey)); if (raw === null) return null; try { return JSON.parse(raw) as TcxDispatchIntent; } catch (error) { throw new Error("tcx_dispatch_intent_corrupt", { cause: error }); } }
  async create(intent: TcxDispatchIntent): Promise<TcxDispatchIntent> { const result = await getRedis().set(safeKey(DISPATCH_INTENT_KEY_PREFIX, intent.dispatchKey), JSON.stringify(intent), "NX"); if (result === "OK") return structuredClone(intent); const existing = await this.get(intent.dispatchKey); if (!existing) throw new Error("tcx_dispatch_intent_create_conflict"); return existing; }
  async claim(dispatchKey: string, claimedAt = new Date().toISOString()): Promise<TcxDispatchIntent> {
    const key = safeKey(DISPATCH_INTENT_KEY_PREFIX, dispatchKey); const client = getRedis(); await client.watch(key);
    try { const raw = await client.get(key); if (raw === null) throw new Error("tcx_dispatch_intent_not_found"); const current = JSON.parse(raw) as TcxDispatchIntent; if (current.status !== "PENDING") return current; const claimed = { ...current, status: "CLAIMED" as const, claimedAt }; const result = await client.multi().set(key, JSON.stringify(claimed)).exec(); if (result === null) throw new Error("tcx_dispatch_intent_claim_conflict"); return structuredClone(claimed); }
    catch (error) { await client.unwatch().catch(() => undefined); throw error; }
  }
  async markPublished(dispatchKey: string, publishedAt = new Date().toISOString()): Promise<TcxDispatchIntent> {
    const key = safeKey(DISPATCH_INTENT_KEY_PREFIX, dispatchKey); const client = getRedis(); await client.watch(key);
    try { const raw = await client.get(key); if (raw === null) throw new Error("tcx_dispatch_intent_not_found"); const current = JSON.parse(raw) as TcxDispatchIntent; if (current.status === "PUBLISHED") return current; const published = { ...current, status: "PUBLISHED" as const, publishedAt }; const result = await client.multi().set(key, JSON.stringify(published)).exec(); if (result === null) throw new Error("tcx_dispatch_intent_version_conflict"); return structuredClone(published); }
    catch (error) { await client.unwatch().catch(() => undefined); throw error; }
  }
}

export async function requireValidTcxLease(transaction: { transactionId: string; attemptId: string; leaseId?: string }, leases: TcxLeaseRepository, now = new Date()): Promise<TcxLease> {
  if (!transaction.leaseId) throw new Error("tcx_lease_required"); const lease = await leases.get(transaction.leaseId); if (!lease) throw new Error("tcx_lease_not_found"); validateTcxLease(transaction, lease, now); return lease;
}

export function buildTcxDispatchKey(transactionId: string, attemptId: string): string { if (!transactionId || !attemptId) throw new Error("tcx_dispatch_identity_invalid"); return `${transactionId}:${attemptId}`; }
