import assert from "node:assert/strict";
import test from "node:test";
import { bindTcxAdmissionAuthority } from "../lib/hoare/admission/tcx-authority-binding";
import { InMemoryExecutionTransactionRepository } from "../lib/hoare/execution/transaction-repository";
import type { ExecutionTransaction } from "../lib/hoare/execution/transaction";
import type { TCXAdmission, TCXTransaction } from "../packages/hoare-contracts/src";

function executionTransaction(): ExecutionTransaction {
  return { transactionId: "tx-1", tenantId: "tenant-1", projectId: "project-1", releaseDigest: "r", artifactDigest: "a", artifactRef: "ref", pasorPlanHash: "p", pasorUnitId: "u", workloadId: "w", agentId: "agent-1", nodeId: "node-1", packId: "pack-1", runtimeKind: "native", leaseId: "lease-1", attemptId: "attempt-1", attemptNumber: 1, idempotencyKey: "idem", state: "AUTHORIZED", stateVersion: 4, createdAt: "now", updatedAt: "now" };
}
function tcxTransaction(): TCXTransaction {
  return { transactionId: "tx-1", attemptId: "attempt-1", tenantId: "tenant-1", projectId: "project-1", agentId: "agent-1", leaseId: "lease-1", expectedStateVersion: 4, stateVersion: 4, idempotencyKey: "idem", state: "AUTHORIZED" };
}
function admission(): TCXAdmission {
  return { transactionId: "tx-1", attemptId: "attempt-1", admitted: true, stateVersion: 4, leaseId: "lease-1", fenceValid: true, authorizationDecisionId: "decision-1", verificationProofId: "proof-1", admittedAt: "now" };
}

test("binds AEGIS decision and proof atomically to the current attempt", async () => {
  const repository = new InMemoryExecutionTransactionRepository();
  await repository.create(executionTransaction());
  await bindTcxAdmissionAuthority(tcxTransaction(), admission(), repository);
  const saved = await repository.get("tx-1");
  assert.equal(saved?.authorizationDecisionId, "decision-1");
  assert.equal(saved?.verificationProofId, "proof-1");
  assert.equal(saved?.stateVersion, 5);
});

test("rejects an admission bound to the wrong attempt", async () => {
  const repository = new InMemoryExecutionTransactionRepository();
  await repository.create(executionTransaction());
  await assert.rejects(bindTcxAdmissionAuthority({ ...tcxTransaction(), attemptId: "wrong" }, admission(), repository), /tcx_admission_attempt_mismatch/);
});

test("rejects stale admission state", async () => {
  const repository = new InMemoryExecutionTransactionRepository();
  await repository.create(executionTransaction());
  await assert.rejects(bindTcxAdmissionAuthority(tcxTransaction(), { ...admission(), stateVersion: 3 }, repository), /tcx_admission_state_version_mismatch/);
});
