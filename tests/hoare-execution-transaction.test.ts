import test from "node:test";
import assert from "node:assert/strict";

import {
  createExecutionTransaction,
  buildExecutionIdempotencyKey,
} from "../lib/hoare/execution/transaction";
import { InMemoryExecutionTransactionRepository } from "../lib/hoare/execution/transaction-repository";
import { ExecutionTransactionCoordinator } from "../lib/hoare/execution/transaction-coordinator";
import { verifyExecutionEvidence } from "../lib/hoare/execution/evidence-verifier";

function transaction(overrides: Record<string, unknown> = {}) {
  return createExecutionTransaction({
    tenantId: "tenant-1",
    organizationId: "org-1",
    projectId: "project-1",
    missionId: "mission-1",
    verticalId: "drone",
    profileId: "perception",
    releaseDigest: "sha256:release",
    artifactDigest: "sha256:artifact",
    artifactRef: "artifacts/perception.tar",
    pasorPlanHash: "sha256:plan",
    pasorUnitId: "unit-1",
    workloadId: "workload-1",
    agentId: "agent-1",
    nodeId: "node-1",
    packId: "pack-1",
    runtimeKind: "python",
    ...overrides,
  });
}

class RecordingBus {
  readonly events: unknown[] = [];

  async publish(event: unknown): Promise<boolean> {
    this.events.push(event);
    return true;
  }
}

test("same transaction attempt identity is stable and idempotent", async () => {
  const repository = new InMemoryExecutionTransactionRepository();
  const bus = new RecordingBus();
  const coordinator = new ExecutionTransactionCoordinator(repository, bus as never);
  const created = transaction({ transactionId: "tx-1", attemptId: "attempt-1" });

  await coordinator.create(created);
  assert.equal(created.idempotencyKey, buildExecutionIdempotencyKey("tx-1", "attempt-1"));
  assert.equal((await repository.findByAttempt("tx-1", "attempt-1"))?.attemptId, "attempt-1");
  assert.throws(() => repository.create(created), /already_exists/);
});

test("retry rotates attempt identity and retains prior evidence", async () => {
  const repository = new InMemoryExecutionTransactionRepository();
  const bus = new RecordingBus();
  const coordinator = new ExecutionTransactionCoordinator(repository, bus as never);
  const created = transaction({ transactionId: "tx-2", attemptId: "attempt-1" });

  await coordinator.create(created);
  await coordinator.transition("tx-2", "AUTHORIZED");
  await coordinator.transition("tx-2", "DISPATCHED");
  await coordinator.transition("tx-2", "ADMITTED");
  await coordinator.transition("tx-2", "RUNNING");
  await coordinator.transition("tx-2", "EXECUTION_FAILED");
  await coordinator.transition("tx-2", "REPAIRING");

  const beforeRetry = await repository.get("tx-2");
  assert.ok(beforeRetry);
  const retried = await coordinator.prepareRetry("tx-2", 3);
  assert.equal(retried.attemptNumber, 2);
  assert.notEqual(retried.attemptId, "attempt-1");
  assert.equal(retried.idempotencyKey, buildExecutionIdempotencyKey("tx-2", retried.attemptId));
  assert.equal(retried.state, "RETRY_PENDING");
  assert.equal(retried.attemptHistory?.length, 1);
  assert.equal(retried.attemptHistory?.[0]?.attemptId, "attempt-1");
  assert.equal(retried.stateVersion, beforeRetry.stateVersion + 1);
});

test("retry is bounded by max attempts", async () => {
  const repository = new InMemoryExecutionTransactionRepository();
  const bus = new RecordingBus();
  const coordinator = new ExecutionTransactionCoordinator(repository, bus as never);
  const created = transaction({ transactionId: "tx-3", attemptId: "attempt-1", attemptNumber: 3 });

  await coordinator.create(created);
  await coordinator.transition("tx-3", "AUTHORIZED");
  await coordinator.transition("tx-3", "DISPATCHED");
  await coordinator.transition("tx-3", "ADMITTED");
  await coordinator.transition("tx-3", "RUNNING");
  await coordinator.transition("tx-3", "EXECUTION_FAILED");
  await coordinator.transition("tx-3", "REPAIRING");

  await assert.rejects(
    coordinator.prepareRetry("tx-3", 3),
    /max_attempts_exceeded/,
  );
});

test("repository rejects illegal transitions even when coordinator is bypassed", async () => {
  const repository = new InMemoryExecutionTransactionRepository();
  await repository.create(transaction({ transactionId: "tx-direct" }));

  await assert.rejects(
    repository.transition("tx-direct", "CREATED", "SUCCEEDED", 1),
    /invalid_execution_transaction_transition:CREATED:SUCCEEDED/,
  );

  assert.equal((await repository.get("tx-direct"))?.state, "CREATED");
  assert.equal((await repository.get("tx-direct"))?.stateVersion, 1);
});

test("stale evidence for an old attempt is rejected before state mutation", async () => {
  const repository = new InMemoryExecutionTransactionRepository();
  const current = transaction({ transactionId: "tx-4", attemptId: "current-attempt" });
  await repository.create(current);

  const { ExecutionEvidenceReconciler } = await import("../lib/hoare/execution/evidence-reconciler");
  const reconciler = new ExecutionEvidenceReconciler(repository);

  await assert.rejects(
    reconciler.reconcile({
      schema: "hoare.execution-evidence/v1",
      transactionId: "tx-4",
      attemptId: "old-attempt",
      tenantId: "tenant-1",
      nodeId: "node-1",
      receipt: {} as never,
      result: {} as never,
      attestation: {} as never,
      status: "SUCCEEDED",
      correlationId: "corr-1",
      emittedAt: new Date().toISOString(),
    }),
    /attempt_mismatch/,
  );

  assert.equal((await repository.get("tx-4"))?.state, "CREATED");
});

test("invalid transaction state transitions are rejected", async () => {
  const repository = new InMemoryExecutionTransactionRepository();
  const bus = new RecordingBus();
  const coordinator = new ExecutionTransactionCoordinator(repository, bus as never);
  await coordinator.create(transaction({ transactionId: "tx-5" }));

  await assert.rejects(
    coordinator.transition("tx-5", "SUCCEEDED"),
    /invalid_execution_transaction_transition:CREATED:SUCCEEDED/,
  );
});

test("evidence verifier rejects cross-object identity mismatches", () => {
  assert.throws(
    () => verifyExecutionEvidence(
      { receipt_hash: "bad" },
      { result_hash: "bad" },
      { attestation_hash: "bad" },
    ),
    /receipt_hash_mismatch/,
  );
});
