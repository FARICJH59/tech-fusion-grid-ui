import assert from "node:assert/strict";
import test from "node:test";
import Redis from "ioredis";
import { RedisSecretCapabilityStore } from "@/lib/hoare/secrets/secret-capability-redis-store";
import type { SecretCapabilityRecord } from "@/lib/hoare/secrets/secret-capability";

const redisUrl = process.env.REDIS_URL;
const shouldRun = Boolean(redisUrl);

const makeRecord = (capabilityId: string): SecretCapabilityRecord => ({
  capabilityId,
  tenantId: "tenant-integration",
  projectId: "project-integration",
  secretId: "secret-integration",
  operation: "read",
  issuedAt: new Date(Date.now()).toISOString(),
  expiresAt: new Date(Date.now() + 60_000).toISOString(),
  status: "active",
});

test("Redis secret capability store: atomic revoke/consume state machine", { skip: !shouldRun }, async () => {
  const redis = new Redis(redisUrl!);
  const prefix = `hoare:test:secret-capability:${process.pid}:${Date.now()}`;
  const store = new RedisSecretCapabilityStore({ redis, keyPrefix: prefix });

  try {
    const revokedId = "cap-revoke-idempotent";
    await store.put(makeRecord(revokedId));
    await store.revoke(revokedId);
    await store.revoke(revokedId);
    assert.equal((await store.get(revokedId))?.status, "revoked");
    await assert.rejects(() => store.consume(revokedId), /secret_capability_not_active/);

    const consumedId = "cap-consume-idempotent";
    await store.put(makeRecord(consumedId));
    const consumed = await store.consume(consumedId);
    assert.equal(consumed.status, "consumed");
    await assert.rejects(() => store.consume(consumedId), /secret_capability_not_active/);
    await assert.rejects(() => store.revoke(consumedId), /secret_capability_not_active/);
    assert.equal((await store.get(consumedId))?.status, "consumed");

    const revokeWinsId = "cap-revoke-wins";
    await store.put(makeRecord(revokeWinsId));
    await store.revoke(revokeWinsId);
    await assert.rejects(() => store.consume(revokeWinsId), /secret_capability_not_active/);

    const consumeWinsId = "cap-consume-wins";
    await store.put(makeRecord(consumeWinsId));
    await store.consume(consumeWinsId);
    await store.revoke(consumeWinsId).catch((error: unknown) => {
      assert.match(String(error), /secret_capability_not_active/);
    });
    assert.equal((await store.get(consumeWinsId))?.status, "consumed");

    const concurrentId = "cap-concurrent";
    await store.put(makeRecord(concurrentId));
    const outcomes = await Promise.allSettled([
      store.consume(concurrentId),
      store.revoke(concurrentId),
    ]);
    const finalRecord = await store.get(concurrentId);

    assert.ok(finalRecord);
    assert.ok(finalRecord.status === "consumed" || finalRecord.status === "revoked");
    assert.equal(
      outcomes.filter((outcome) => outcome.status === "fulfilled").length,
      1,
      "exactly one terminal transition must win the concurrent race",
    );
  } finally {
    const keys = await redis.keys(`${prefix}:*`);
    if (keys.length > 0) await redis.del(...keys);
    await redis.quit();
  }
});
