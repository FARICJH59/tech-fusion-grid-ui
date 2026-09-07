import assert from "node:assert/strict";
import test from "node:test";
import { ExecutionTransactionCoordinator } from "../lib/hoare/execution/transaction-coordinator";
import { InMemoryExecutionTransactionRepository } from "../lib/hoare/execution/transaction-repository";
import type { ExecutionTransaction } from "../lib/hoare/execution/transaction";

const BASE: ExecutionTransaction = {
  transactionId: "tx-retry",
  tenantId: "tenant-1",
  projectId: "project-1",
  releaseDigest: "release",
  artifactDigest: "artifact",
  artifactRef: "ref",
  pasorPlanHash: "plan",
  pasorUnitId: "unit",
  workloadId: "workload",
  agentId: "agent-1",
  nodeId: "node-1",
  packId: "pack-1",
  runtimeKind: "native",
  leaseId: "lease-1",
  attemptId: "attempt-1",
  attemptNumber: 1,
  idempotencyKey: "idem-1",
  authorizationDecisionId: "decision-1",
  verificationProofId: "proof-1",
  state: "REPAIRING",
  stateVersion: 7,
  createdAt: "2026-09-06T18:00:00.000Z",
  updatedAt: "2026-09-06T18:00:00.000Z",
};

function coordinator(repository: InMemoryExecutionTransactionRepository) {
  return new ExecutionTransactionCoordinator(repository, { publish: async () => true } as never);
}

test("retry rotates identity and clears prior AEGIS authority", async () => {
  const repository = new InMemoryExecutionTransactionRepository();
  await repository.create(BASE);
  const retried = await coordinator(repository).prepareRetry("tx-retry", 3);

  assert.notEqual(retried.attemptId, "attempt-1");
  assert.equal(retried.attemptNumber, 2);
  assert.equal(retried.authorizationDecisionId, undefined);
  assert.equal(retried.verificationProofId, undefined);
  assert.equal(retried.attemptHistory?.[0]?.authorizationDecisionId, "decision-1");
  assert.equal(retried.attemptHistory?.[0]?.verificationProofId, "proof-1");
});

test("retry cannot transition to AUTHORIZED without a fresh authority binding", async () => {
  const repository = new InMemoryExecutionTransactionRepository();
  await repository.create(BASE);
  await coordinator(repository).prepareRetry("tx-retry", 3);

  await assert.rejects(
    coordinator(repository).transition("tx-retry", "AUTHORIZED"),
    /tcx_authorization_requires_fresh_authority_binding/,
  );

  const saved = await repository.get("tx-retry");
  assert.equal(saved?.state, "RETRY_PENDING");
  assert.equal(saved?.authorizationDecisionId, undefined);
  assert.equal(saved?.verificationProofId, undefined);
});
