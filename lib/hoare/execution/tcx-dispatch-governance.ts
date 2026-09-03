import { getRedis } from "@/lib/redis";
import { validateTcxLease, type TcxLease } from "./tcx-governance";

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

export interface TcxDispatchIntentRepository { get(k:string):Promise<TcxDispatchIntent|null>; create(v:TcxDispatchIntent):Promise<TcxDispatchIntent>; claim(k:string,claimedAt?:string):Promise<TcxDispatchIntent>; markPublished(k:string,publishedAt?:string):Promise<TcxDispatchIntent>; }
function claimRecord(v:TcxDispatchIntent, now:string):TcxDispatchIntent { return {...v,status:"CLAIMED",claimedAt:now,claimExpiresAt:new Date(Date.parse(now)+CLAIM_TTL_MS).toISOString()}; }
export class InMemoryTcxDispatchIntentRepository implements TcxDispatchIntentRepository {
  private readonly intents=new Map<string,TcxDispatchIntent>();
  async get(k:string){const v=this.intents.get(k);return v?structuredClone(v):null;}
  async create(v:TcxDispatchIntent){const c=this.intents.get(v.dispatchKey);if(c)return structuredClone(c);this.intents.set(v.dispatchKey,structuredClone(v));return structuredClone(v);}
  async claim(k:string,at=new Date().toISOString()){const c=this.intents.get(k);if(!c)throw new Error("tcx_dispatch_intent_not_found");if(c.status==="PUBLISHED")return structuredClone(c);if(c.status==="CLAIMED"&&c.claimExpiresAt&&Date.parse(c.claimExpiresAt)>Date.parse(at))throw new Error("tcx_dispatch_intent_claimed");const v=claimRecord(c,at);this.intents.set(k,v);return structuredClone(v);}
  async markPublished(k:string,at=new Date().toISOString()){const c=this.intents.get(k);if(!c)throw new Error("tcx_dispatch_intent_not_found");if(c.status==="PUBLISHED")return structuredClone(c);const v={...c,status:"PUBLISHED" as const,publishedAt:at};this.intents.set(k,v);return structuredClone(v);}
}
export class RedisTcxDispatchIntentRepository implements TcxDispatchIntentRepository {
  async get(k:string){const raw=await getRedis().get(safeKey(DISPATCH_INTENT_KEY_PREFIX,k));if(raw===null)return null;try{return JSON.parse(raw) as TcxDispatchIntent;}catch(error){throw new Error("tcx_dispatch_intent_corrupt",{cause:error});}}
  async create(v:TcxDispatchIntent){const r=await getRedis().set(safeKey(DISPATCH_INTENT_KEY_PREFIX,v.dispatchKey),JSON.stringify(v),"NX");if(r==="OK")return structuredClone(v);const c=await this.get(v.dispatchKey);if(!c)throw new Error("tcx_dispatch_intent_create_conflict");return c;}
  async claim(k:string,at=new Date().toISOString()){const key=safeKey(DISPATCH_INTENT_KEY_PREFIX,k),c=getRedis();await c.watch(key);try{const raw=await c.get(key);if(raw===null)throw new Error("tcx_dispatch_intent_not_found");const current=JSON.parse(raw) as TcxDispatchIntent;if(current.status==="PUBLISHED")return current;if(current.status==="CLAIMED"&&current.claimExpiresAt&&Date.parse(current.claimExpiresAt)>Date.parse(at))throw new Error("tcx_dispatch_intent_claimed");const v=claimRecord(current,at),r=await c.multi().set(key,JSON.stringify(v)).exec();if(r===null)throw new Error("tcx_dispatch_intent_claim_conflict");return structuredClone(v);}catch(e){await c.unwatch().catch(()=>undefined);throw e;}}
  async markPublished(k:string,at=new Date().toISOString()){const key=safeKey(DISPATCH_INTENT_KEY_PREFIX,k),c=getRedis();await c.watch(key);try{const raw=await c.get(key);if(raw===null)throw new Error("tcx_dispatch_intent_not_found");const current=JSON.parse(raw) as TcxDispatchIntent;if(current.status==="PUBLISHED")return current;const v={...current,status:"PUBLISHED" as const,publishedAt:at},r=await c.multi().set(key,JSON.stringify(v)).exec();if(r===null)throw new Error("tcx_dispatch_intent_version_conflict");return structuredClone(v);}catch(e){await c.unwatch().catch(()=>undefined);throw e;}}
}
export async function requireValidTcxLease(t:{transactionId:string;attemptId:string;leaseId?:string},leases:TcxLeaseRepository,now=new Date()){if(!t.leaseId)throw new Error("tcx_lease_required");const l=await leases.get(t.leaseId);if(!l)throw new Error("tcx_lease_not_found");validateTcxLease(t,l,now);return l;}
export function buildTcxDispatchKey(transactionId:string,attemptId:string){if(!transactionId||!attemptId)throw new Error("tcx_dispatch_identity_invalid");return `${transactionId}:${attemptId}`;}
