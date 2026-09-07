import Redis from "ioredis";
import type { SecretCapabilityRecord, SecretCapabilityStore } from "./secret-capability";

const CONSUME_SCRIPT = `
local value = redis.call("GET", KEYS[1])
if not value then return {"NOT_FOUND", ""} end
local record = cjson.decode(value)
if record.status ~= "active" then return {"NOT_ACTIVE", value} end
local ttl = redis.call("PTTL", KEYS[1])
if ttl < 1 then return {"EXPIRED", value} end
record.status = "consumed"
local encoded = cjson.encode(record)
redis.call("PSETEX", KEYS[1], ttl, encoded)
return {"OK", encoded}
`;

const REVOKE_SCRIPT = `
local value = redis.call("GET", KEYS[1])
if not value then return {"NOT_FOUND", ""} end
local record = cjson.decode(value)
if record.status == "revoked" then return {"ALREADY_REVOKED", value} end
if record.status ~= "active" then return {"NOT_ACTIVE", value} end
local ttl = redis.call("PTTL", KEYS[1])
if ttl < 1 then return {"EXPIRED", value} end
record.status = "revoked"
local encoded = cjson.encode(record)
redis.call("PSETEX", KEYS[1], ttl, encoded)
return {"OK", encoded}
`;

const assertCapabilityId = (capabilityId: string): string => {
  const normalized = capabilityId.trim();
  if (!normalized) throw new Error("secret_capability_id_required");
  return normalized;
};

const parseRecord = (value: string | null): SecretCapabilityRecord | null => {
  if (!value) return null;
  return JSON.parse(value) as SecretCapabilityRecord;
};

/**
 * Production-oriented Redis implementation of the capability store.
 * Records contain metadata only; secret material is never persisted here.
 * `consume` and `revoke` are atomic state transitions implemented by Lua.
 */
export class RedisSecretCapabilityStore implements SecretCapabilityStore {
  private readonly redis: Redis;
  private readonly prefix: string;

  constructor(options: { redis: Redis; keyPrefix?: string }) {
    this.redis = options.redis;
    this.prefix = (options.keyPrefix ?? "hoare:secret-capability").replace(/:$/, "");
  }

  private key(capabilityId: string): string {
    return `${this.prefix}:${assertCapabilityId(capabilityId)}`;
  }

  async put(record: SecretCapabilityRecord): Promise<void> {
    const ttlMs = Date.parse(record.expiresAt) - Date.now();
    if (ttlMs <= 0) throw new Error("secret_capability_expired");
    const result = await this.redis.set(
      this.key(record.capabilityId),
      JSON.stringify(record),
      "PX",
      ttlMs,
      "NX",
    );
    if (result !== "OK") throw new Error("secret_capability_duplicate");
  }

  async get(capabilityId: string): Promise<SecretCapabilityRecord | null> {
    return parseRecord(await this.redis.get(this.key(capabilityId)));
  }

  async revoke(capabilityId: string): Promise<void> {
    const key = this.key(capabilityId);
    const result = (await this.redis.eval(REVOKE_SCRIPT, 1, key)) as [string, string];
    const [status] = result;
    if (status === "NOT_FOUND") return;
    if (status === "ALREADY_REVOKED") return;
    if (status === "NOT_ACTIVE") throw new Error("secret_capability_not_active");
    if (status === "EXPIRED") throw new Error("secret_capability_expired");
    if (status !== "OK") throw new Error("secret_capability_revoke_failed");
  }

  async consume(capabilityId: string): Promise<SecretCapabilityRecord> {
    const key = this.key(capabilityId);
    const result = (await this.redis.eval(CONSUME_SCRIPT, 1, key)) as [string, string];
    const [status, value] = result;
    if (status === "NOT_FOUND") throw new Error("secret_capability_not_found");
    if (status === "NOT_ACTIVE") throw new Error("secret_capability_not_active");
    if (status === "EXPIRED") throw new Error("secret_capability_expired");
    if (status !== "OK") throw new Error("secret_capability_consume_failed");
    return JSON.parse(value) as SecretCapabilityRecord;
  }
}
