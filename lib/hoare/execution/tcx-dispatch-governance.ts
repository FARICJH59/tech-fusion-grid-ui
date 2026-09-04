import { getRedis } from "@/lib/redis";
import { validateTcxLease, type TcxLease } from "./tcx-governance";

export type { TcxLease } from "./tcx-governance";
export type TcxDispatchIntentStatus = "PENDING" | "CLAIMED" | "PUBLISHED";
export type TcxDispatchIntent = {
  dispatchKey: string; transactionId: string; attemptId: string; attemptNumber: number;
  stateVersion: number; idempotencyKey: string; channelId?: string;
  status: TcxDispatchIntentStatus; createdAt: string; claimedAt?: string;
  claimExpiresAt?: string; publishedAt?: string;
};

export interface TcxLeaseRepository { get(leaseId: string): Promise<TcxLease | null>; put(lease: TcxLease): Promise<TcxLease>; revoke(leaseId: string, revokedAt?: string): Promise<TcxLease>; }
export class InMemoryTcxLeaseRepository implements TcxLeaseRepository {
  private readonly leases = new Map<string, TcxLease>();
  async get(id: string) { const v=this.leases.get(id); return v?structuredClone(v):null; }
  async put(v:TcxLease){if(this.leases.has(v.leaseId))throw new Error("tcx_lease_already_exists");this.leases.set(v.leaseId,structuredClone(v));return structuredClone(v);}
  async revoke(id:string,at=new Date().toISOString()){const v=this.leases.get(id);if(!v)throw new Error("tcx_lease_not_found");const r={...v,revokedAt:at};this.leases.set(id,r);return structuredClone(r);}
}
const LEASE_KEY_PREFIX="hoare:tcx:lease", DISPATCH_INTENT_KEY_PREFIX="hoare:tcx:dispatch-intent", CLAIM_TTL_MS=30_000;
function safeKey(prefix:string,id:string){if(!id||id.includes("\u0000"))throw new Error("tcx_governance_invalid_key");return `${prefix}:${id}`;}
export class RedisTcxLeaseRepository implements TcxLeaseRepository {
  async get(id:string){const raw=await getRedis().get(safeKey(LEASE_KEY_PREFIX,id));if(raw===null)return null;try{return JSON.parse(raw) as TcxLease;}catch(error){throw new Error("tcx_lease_corrupt",{cause:error});}}
  async put(v:TcxLease){const r=await getRedis().set(safeKey(LEASE_KEY_PREFIX,v.leaseId),JSON.stringify(v),"NX");if(r!=="OK")throw new Error("tcx_lease_already_exists");return structuredClone(v);}
  async revoke(id:string,at=new Date().toISOString()){const key=safeKey(LEASE_KEY_PREFIX,id),c=getRedis();await c.watch(key);try{const raw=await c.get(key);if(raw===null)throw new Error("tcx_lease_not_found");const v={...(JSON.parse(raw) as TcxLease),revokedAt:at},r=await c.multi().set(key,JSON.stringify(v)).exec();if(r===null)throw new Error("tcx_lease_version_conflict");return structuredClone(v);}catch(e){await c.unwatch().catch(()=>undefined);throw e;}}
}

export function buildTcxDispatchKey(transactionId: string, attemptId: string): string { return `${transactionId}:${attemptId}`; }
export function requireValidTcxLease(transaction: { leaseId?: string | null; transactionId: string; attemptId: string }, leases: TcxLeaseRepository): Promise<TcxLease> { if (!transaction.leaseId) throw new Error("tcx_lease_required"); return leases.get(transaction.leaseId).then((lease) => { if (!lease) throw new Error("tcx_lease_not_found"); validateTcxLease(lease, transaction); return lease; }); }

export interface TcxDispatchIntentRepository { get(dispatchKey:string):Promise<TcxDispatchIntent|null>; create(intent:TcxDispatchIntent):Promise<TcxDispatchIntent>; claim(dispatchKey:string,now?:string):Promise<TcxDispatchIntent>; markPublished(dispatchKey:string,now?:string):Promise<TcxDispatchIntent>; }
export class InMemoryTcxDispatchIntentRepository implements TcxDispatchIntentRepository {
  private readonly intents=new Map<string,TcxDispatchIntent>();
  async get(k:string){const v=this.intents.get(k);return v?structuredClone(v):null;}
  async create(v:TcxDispatchIntent){const e=this.intents.get(v.dispatchKey);if(e)return structuredClone(e);this.intents.set(v.dispatchKey,structuredClone(v));return structuredClone(v);}
  async claim(k:string,now=new Date().toISOString()){const v=this.intents.get(k);if(!v)throw new Error("tcx_dispatch_intent_not_found");if(v.status==="PUBLISHED")return structuredClone(v);if(v.status==="CLAIMED"&&v.claimExpiresAt&&v.claimExpiresAt>now)return structuredClone(v);const r={...v,status:"CLAIMED" as const,claimedAt:now,claimExpiresAt:new Date(Date.parse(now)+CLAIM_TTL_MS).toISOString()};this.intents.set(k,r);return structuredClone(r);}
  async markPublished(k:string,now=new Date().toISOString()){const v=this.intents.get(k);if(!v)throw new Error("tcx_dispatch_intent_not_found");const r={...v,status:"PUBLISHED" as const,publishedAt:now};this.intents.set(k,r);return structuredClone(r);}
}
export class RedisTcxDispatchIntentRepository implements TcxDispatchIntentRepository {
  async get(k:string){const raw=await getRedis().get(safeKey(DISPATCH_INTENT_KEY_PREFIX,k));return raw?JSON.parse(raw) as TcxDispatchIntent:null;}
  async create(v:TcxDispatchIntent){const key=safeKey(DISPATCH_INTENT_KEY_PREFIX,v.dispatchKey),c=getRedis(),ok=await c.set(key,JSON.stringify(v),"NX");if(ok!=="OK")return (await this.get(v.dispatchKey))!;return structuredClone(v);}
  async claim(k:string,now=new Date().toISOString()){const key=safeKey(DISPATCH_INTENT_KEY_PREFIX,k),v=await this.get(k);if(!v)throw new Error("tcx_dispatch_intent_not_found");if(v.status==="PUBLISHED")return v;if(v.status==="CLAIMED"&&v.claimExpiresAt&&v.claimExpiresAt>now)return v;const r={...v,status:"CLAIMED" as const,claimedAt:now,claimExpiresAt:new Date(Date.parse(now)+CLAIM_TTL_MS).toISOString()};await getRedis().set(key,JSON.stringify(r));return r;}
  async markPublished(k:string,now=new Date().toISOString()){const key=safeKey(DISPATCH_INTENT_KEY_PREFIX,k),v=await this.get(k);if(!v)throw new Error("tcx_dispatch_intent_not_found");const r={...v,status:"PUBLISHED" as const,publishedAt:now};await getRedis().set(key,JSON.stringify(r));return r;}
}
