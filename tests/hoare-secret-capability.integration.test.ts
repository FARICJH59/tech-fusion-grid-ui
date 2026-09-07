import test from "node:test";
import assert from "node:assert/strict";
import Redis from "ioredis";
import { RedisSecretCapabilityStore } from "@/lib/hoare/secrets/secret-capability-redis-store";
import type { SecretCapabilityRecord } from "@/lib/hoare/secrets/secret-capability";

const redisUrl = process.env.REDIS_URL;

test("Redis capability store consumes a capability exactly once", { skip: !redisUrl }, async () => {
  const redis = new Redis(redisUrl!, { maxRetriesPerRequest: 1 });
  const store = new RedisSecretCapabilityStore({
    redis,
    keyPrefix: `hoare:test:secret-capability:${process.pid}:${Date.now()}`,
  });
  const record: SecretCapabilityRecord = {
    capabilityId: `cap-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    policyId: "policy-a",
    scope: {
      tenantId: "tenant-a",
      projectId: "project-a",
      transactionId: "tx-a",
      attemptId: "attempt-a",
      secretId: "cloudflare-api-token",
      agentId: "agent-a",
      workloadId: "workload-a",
      environment: "production",
      operation: "read",
      nodeId: "node-a",
      runtimeKind: "cloud-run",
      secretVersion: "42",
    },
    issuedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 30_000).toISOString(),
    status: "active",
  };

  try {
    await store.put(record);
    const results = await Promise.allSettled([
      store.consume(record.capabilityId),
      store.consume(record.capabilityId),
    ]);
    assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
    assert.equal(results.filter((result) => result.status === "rejected").length, 1);

    const stored = await store.get(record.capabilityId);
    assert.equal(stored?.status, "consumed");
  } finally {
    await redis.quit();
  }
});
