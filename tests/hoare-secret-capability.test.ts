import test from "node:test";
import assert from "node:assert/strict";
import { InMemorySecretCapabilityStore } from "@/lib/hoare/secrets/secret-capability";

test("secret capability store is single-use", async () => {
  const store = new InMemorySecretCapabilityStore();
  const record = Object.freeze({
    capabilityId: "cap-1",
    policyId: "tenant-a:policy-1",
    scope: Object.freeze({
      tenantId: "tenant-a",
      projectId: "project-a",
      transactionId: "tx-a",
      attemptId: "attempt-a",
      secretId: "api-token",
      agentId: "agent-a",
      workloadId: "workload-a",
      environment: "production",
      operation: "read" as const,
      nodeId: "node-a",
      runtimeKind: "cloud-run",
      secretVersion: "42",
    }),
    issuedAt: "2026-09-07T00:00:00.000Z",
    expiresAt: "2026-09-07T00:01:00.000Z",
    status: "active" as const,
  });

  await store.put(record);
  const consumed = await store.consume("cap-1");
  assert.equal(consumed.status, "consumed");
  await assert.rejects(store.consume("cap-1"), /secret_capability_not_active/);
});

test("secret capability revocation is idempotent and fail-closed", async () => {
  const store = new InMemorySecretCapabilityStore();
  await store.revoke("missing");
  const record = Object.freeze({
    capabilityId: "cap-2",
    policyId: "policy-2",
    scope: Object.freeze({
      tenantId: "tenant-a",
      projectId: "project-a",
      transactionId: "tx-a",
      attemptId: "attempt-a",
      secretId: "api-token",
      agentId: "agent-a",
      workloadId: "workload-a",
      environment: "production",
      operation: "read" as const,
    }),
    issuedAt: "2026-09-07T00:00:00.000Z",
    expiresAt: "2026-09-07T00:01:00.000Z",
    status: "active" as const,
  });

  await store.put(record);
  await store.revoke("cap-2");
  assert.equal((await store.get("cap-2"))?.status, "revoked");
  await assert.rejects(store.consume("cap-2"), /secret_capability_not_active/);
});

test("secret capability records contain no secret material field", async () => {
  const store = new InMemorySecretCapabilityStore();
  const record = Object.freeze({
    capabilityId: "cap-3",
    policyId: "policy-3",
    scope: Object.freeze({
      tenantId: "tenant-a",
      projectId: "project-a",
      transactionId: "tx-a",
      attemptId: "attempt-a",
      secretId: "api-token",
      agentId: "agent-a",
      workloadId: "workload-a",
      environment: "production",
      operation: "read" as const,
    }),
    issuedAt: "2026-09-07T00:00:00.000Z",
    expiresAt: "2026-09-07T00:01:00.000Z",
    status: "active" as const,
  });

  await store.put(record);
  const stored = await store.get("cap-3");
  assert.ok(stored);
  assert.equal("value" in stored, false);
  assert.equal("secretValue" in stored, false);
  assert.equal("payload" in stored, false);
});
