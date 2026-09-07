import assert from "node:assert/strict";
import test from "node:test";
import { issueTcxExecutionAuthority } from "../lib/hoare/runtime/tcx-authority-factory";
import type { ExecutionTransaction } from "../lib/hoare/execution/transaction";

function transaction(): ExecutionTransaction {
  return {
    transactionId: "tx-1", tenantId: "tenant-1", projectId: "project-1", releaseDigest: "release", artifactDigest: "artifact", artifactRef: "artifact-ref", pasorPlanHash: "plan", pasorUnitId: "unit", workloadId: "workload", agentId: "agent", nodeId: "node", packId: "pack", runtimeKind: "native", leaseId: "lease-1", authorizationDecisionId: "decision-1", verificationProofId: "proof-1", attemptId: "attempt-1", attemptNumber: 1, idempotencyKey: "idem", state: "RUNNING", stateVersion: 7, createdAt: "now", updatedAt: "now",
  };
}

test("TCX issues authority only for a running, leased, fenced attempt", async () => {
  const tx = transaction();
  const deps = {
    transactions: { async get() { return tx; } } as never,
    leases: { async get() { return { id: "lease-1", transactionId: "tx-1", attemptId: "attempt-1", tenantId: "tenant-1", expiresAt: "2099-01-01T00:00:00.000Z" }; } },
    fence: { async isActive() { return true; } },
  };
  const authority = await issueTcxExecutionAuthority("tx-1", deps);
  assert.equal(authority.transactionId, "tx-1");
  assert.equal(authority.authorizationDecisionId, "decision-1");
  assert.equal(authority.verificationProofId, "proof-1");
});

test("TCX authority rejects missing AEGIS proof binding", async () => {
  const tx = { ...transaction(), verificationProofId: undefined };
  const deps = {
    transactions: { async get() { return tx; } } as never,
    leases: { async get() { return { id: "lease-1", transactionId: "tx-1", attemptId: "attempt-1", tenantId: "tenant-1", expiresAt: "2099-01-01T00:00:00.000Z" }; } },
    fence: { async isActive() { return true; } },
  };
  await assert.rejects(issueTcxExecutionAuthority("tx-1", deps), /tcx_authority_proof_binding_required/);
});

test("issued authority becomes invalid when transaction state or version changes", async () => {
  let current = transaction();
  const deps = {
    transactions: { async get() { return current; } } as never,
    leases: { async get() { return { id: "lease-1", transactionId: "tx-1", attemptId: "attempt-1", tenantId: "tenant-1", expiresAt: "2099-01-01T00:00:00.000Z" }; } },
    fence: { async isActive() { return true; } },
  };
  const authority = await issueTcxExecutionAuthority("tx-1", deps);
  current = { ...current, stateVersion: 8 };
  await assert.rejects(authority.assertValid(), /tcx_authority_state_version_stale/);
});
