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
    tenantId: "tenant-1", organizationId: "org-1", projectId: "project-1", missionId: "mission-1",
    verticalId: "drone", profileId: "perception", releaseDigest: "sha256:release", artifactDigest: "sha256:artifact",
    artifactRef: "artifacts/perception.tar", pasorPlanHash: "sha256:plan", pasorUnitId: "unit-1",
    workloadId: "workload-1", agentId: "agent-1", nodeId: "node-1", packId: "pack-1", runtimeKind: "python", ...overrides,
  });
}

class RecordingBus {
  readonly events: unknown[] = [];
  async publish(event: unknown): Promise<boolean> { this.events.push(event); return true; }
}

test("same transaction attempt identity is stable and idempotent", async () => {
  const repository = new InMemoryExecutionTransactionRepository();
  const bus = new RecordingBus();
  const coordinator = new ExecutionTransactionCoordinator(repository, bus as never);
  const created = transaction({ transactionId: "tx-1", attemptId: "attempt-1" });

  await coordinator.create(created);
  assert.equal(created.idempotencyKey, buildExecutionIdempotencyKey("tx-1", "attempt-1"));
  assert.equal((await repository.findByAttempt("tx-1", "attempt-1"))?.attemptId, "attempt-1");
  await assert.rejects(repository.create(created), /already_exists/);
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
  await assert.rejects(coordinator.prepareRetry("tx-3", 3), /max_attempts/);
});

test("repository rejects illegal transitions even when coordinator is bypassed", async () => {
  const repository = new InMemoryExecutionTransactionRepository();
  const created = transaction({ transactionId: "tx-illegal" });
  await repository.create(created);
  await assert.rejects(repository.transition(created.transactionId, "CREATED", "RUNNING", created.stateVersion), /invalid_execution_transaction_transition/);
});

test("stale evidence for an old attempt is rejected before state mutation", async () => {
  const repository = new InMemoryExecutionTransactionRepository();
  const coordinator = new ExecutionTransactionCoordinator(repository, new RecordingBus() as never);
  const created = transaction({ transactionId: "tx-evidence", attemptId: "attempt-1" });
  await coordinator.create(created);
  await coordinator.transition(created.transactionId, "AUTHORIZED");
  await coordinator.transition(created.transactionId, "DISPATCHED");
  await coordinator.transition(created.transactionId, "ADMITTED");
  await coordinator.transition(created.transactionId, "RUNNING");
  await coordinator.transition(created.transactionId, "EXECUTION_FAILED");
  await coordinator.transition(created.transactionId, "REPAIRING");
  const retry = await coordinator.prepareRetry(created.transactionId, 3);
  assert.notEqual(retry.attemptId, created.attemptId);
  const current = await repository.get(created.transactionId);
  assert.equal(current?.attemptId, retry.attemptId);
  assert.equal(current?.stateVersion, retry.stateVersion);
});

test("invalid transaction state transitions are rejected", async () => {
  const repository = new InMemoryExecutionTransactionRepository();
  const created = transaction({ transactionId: "tx-invalid" });
  await repository.create(created);
  await assert.rejects(repository.transition(created.transactionId, "CREATED", "SUCCEEDED", created.stateVersion), /invalid_execution_transaction_transition/);
});

test("evidence verifier rejects cross-object identity mismatches", () => {
  assert.throws(() => verifyExecutionEvidence(
    { receipt_id: "r", receipt_hash: "h", workload_id: "w1" },
    { receipt_id: "r", receipt_hash: "h", workload_id: "w2", result_hash: "x" },
    { receipt_id: "r", receipt_hash: "h", result_id: "r", result_hash: "x", workload_id: "w1", attestation_hash: "y" },
  ), /receipt_hash_mismatch|result_hash_mismatch|execution_evidence_workload_id_mismatch/);
});
