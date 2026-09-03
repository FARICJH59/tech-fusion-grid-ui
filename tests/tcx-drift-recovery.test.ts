import test from "node:test";
import assert from "node:assert/strict";
import { InMemoryExecutionTransactionRepository } from "../lib/hoare/execution/transaction-repository";
import { createExecutionTransaction } from "../lib/hoare/execution/transaction";
import { recoverFromTcxDrift } from "../lib/hoare/execution/tcx-drift-recovery";

function transaction() {
  return createExecutionTransaction({
    tenantId: "tenant-1",
    projectId: "project-1",
    releaseDigest: "release-1",
    artifactDigest: "artifact-1",
    artifactRef: "artifact://1",
    pasorPlanHash: "plan-1",
    pasorUnitId: "unit-1",
    workloadId: "workload-1",
    agentId: "agent-1",
    nodeId: "node-1",
    packId: "pack-1",
    runtimeKind: "python",
  });
}

test("drift recovery fences, replans, rotates attempt, and requires reauthorization", async () => {
  const repository = new InMemoryExecutionTransactionRepository();
  const original = transaction();
  await repository.create(original);
  const mutated = await repository.update({ ...original, artifactDigest: "artifact-2" }, original.stateVersion);

  const result = await recoverFromTcxDrift(
    mutated.transactionId,
    original,
    repository,
    {
      replan: async () => ({ artifactDigest: "artifact-3", pasorPlanHash: "plan-2" }),
      reauthorize: async () => true,
    },
    3,
    {},
    new Date("2026-09-03T16:00:00.000Z"),
  );

  assert.equal(result.drift.drifted, true);
  assert.equal(result.replanned, true);
  assert.equal(result.reauthorized, true);
  assert.equal(result.transaction.state, "AUTHORIZED");
  assert.equal(result.transaction.attemptNumber, 2);
  assert.notEqual(result.transaction.attemptId, original.attemptId);
  assert.equal(result.transaction.artifactDigest, "artifact-3");
  assert.equal(result.transaction.pasorPlanHash, "plan-2");
});

test("drift recovery stops when AEGIS reauthorization denies the new attempt", async () => {
  const repository = new InMemoryExecutionTransactionRepository();
  const original = transaction();
  await repository.create(original);
  const mutated = await repository.update({ ...original, artifactDigest: "artifact-2" }, original.stateVersion);

  const result = await recoverFromTcxDrift(
    mutated.transactionId,
    original,
    repository,
    { replan: async () => ({}), reauthorize: async () => false },
    2,
    {},
    new Date("2026-09-03T16:00:00.000Z"),
  );

  assert.equal(result.replanned, true);
  assert.equal(result.reauthorized, false);
  assert.equal(result.transaction.state, "RETRY_PENDING");
});

test("drift recovery respects max attempts", async () => {
  const repository = new InMemoryExecutionTransactionRepository();
  const original = transaction();
  const retryable = { ...original, state: "EXECUTION_FAILED" as const, attemptNumber: 2 };
  await repository.create(retryable);

  await assert.rejects(
    recoverFromTcxDrift(
      retryable.transactionId,
      original,
      repository,
      { replan: async () => ({}), reauthorize: async () => true },
      2,
    ),
    /execution_transaction_max_attempts_exceeded/,
  );
});
