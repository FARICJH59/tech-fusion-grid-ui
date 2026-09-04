import test from "node:test";
import assert from "node:assert/strict";
import { InMemoryExecutionTransactionRepository } from "../lib/hoare/execution/transaction-repository";
import { createExecutionTransaction } from "../lib/hoare/execution/transaction";
import { ExecutionTransactionCoordinator } from "../lib/hoare/execution/transaction-coordinator";
import { InMemoryTcxExecutionFenceController } from "../lib/hoare/execution/tcx-execution-fence";
import { InMemoryTcxLeaseRepository } from "../lib/hoare/execution/tcx-dispatch-governance";
import { recoverFromTcxDrift } from "../lib/hoare/execution/tcx-drift-recovery";

function transaction() {
  return createExecutionTransaction({ tenantId: "tenant-1", projectId: "project-1", releaseDigest: "release-1", artifactDigest: "artifact-1", artifactRef: "artifact://1", pasorPlanHash: "plan-1", pasorUnitId: "unit-1", workloadId: "workload-1", agentId: "agent-1", nodeId: "node-1", packId: "pack-1", runtimeKind: "python" });
}

test("drift recovery fences, replans, rotates attempt, and requires reauthorization", async () => {
  const repository = new InMemoryExecutionTransactionRepository();
  const original = transaction();
  await repository.create(original);
  const mutated = await repository.update({ ...original, state: "EXECUTION_FAILED", artifactDigest: "artifact-2" }, original.stateVersion);
  const result = await recoverFromTcxDrift(mutated.transactionId, original, repository, { replan: async () => ({ artifactDigest: "artifact-3", pasorPlanHash: "plan-2" }), reauthorize: async () => true }, 3, {}, new Date("2026-09-03T16:00:00.000Z"));
  assert.equal(result.drift.drifted, true);
  assert.equal(result.replanned, true);
  assert.equal(result.reauthorized, true);
  assert.equal(result.transaction.state, "AUTHORIZED");
  assert.equal(result.transaction.attemptNumber, 2);
  assert.notEqual(result.transaction.attemptId, original.attemptId);
  assert.equal(result.transaction.artifactDigest, "artifact-3");
  assert.equal(result.transaction.pasorPlanHash, "plan-2");
});

test("drift recovery atomically fences the active attempt and revokes its lease", async () => {
  const repository = new InMemoryExecutionTransactionRepository();
  const leases = new InMemoryTcxLeaseRepository();
  const authority = new InMemoryTcxExecutionFenceController();
  const original = transaction();
  await repository.create(original);
  const coordinator = new ExecutionTransactionCoordinator(repository);
  const authorized = await coordinator.transition(original.transactionId, "AUTHORIZED");
  const leaseId = "lease-atomic-1";
  const leased = await repository.update({ ...authorized, state: "AUTHORIZED", leaseId }, authorized.stateVersion);
  await leases.put({ leaseId, transactionId: leased.transactionId, attemptId: leased.attemptId, holderId: "node-1", issuedAt: "2026-09-03T15:00:00.000Z", expiresAt: "2026-09-03T17:00:00.000Z" });
  const dispatched = await coordinator.transition(leased.transactionId, "DISPATCHED");
  const result = await recoverFromTcxDrift(dispatched.transactionId, { ...dispatched, artifactDigest: "artifact-before" }, repository, { replan: async () => ({}), reauthorize: async () => false }, 3, {}, new Date("2026-09-03T16:00:00.000Z"), authority, leases);
  const fence = await authority.get(dispatched.transactionId, dispatched.attemptId);
  const revokedLease = await leases.get(leaseId);
  assert.equal(fence?.state, "FENCED");
  assert.equal(revokedLease?.revokedAt, "2026-09-03T16:00:00.000Z");
  assert.equal(result.transaction.state, "RETRY_PENDING");
});

test("drift recovery refuses active leased recovery without atomic authority", async () => {
  const repository = new InMemoryExecutionTransactionRepository();
  const leases = new InMemoryTcxLeaseRepository();
  const original = transaction();
  await repository.create(original);
  const coordinator = new ExecutionTransactionCoordinator(repository);
  const authorized = await coordinator.transition(original.transactionId, "AUTHORIZED");
  const leaseId = "lease-required-1";
  const leased = await repository.update({ ...authorized, leaseId }, authorized.stateVersion);
  await leases.put({ leaseId, transactionId: leased.transactionId, attemptId: leased.attemptId, holderId: "node-1", issuedAt: "2026-09-03T15:00:00.000Z", expiresAt: "2026-09-03T17:00:00.000Z" });
  const dispatched = await coordinator.transition(leased.transactionId, "DISPATCHED");
  await assert.rejects(recoverFromTcxDrift(dispatched.transactionId, { ...dispatched, artifactDigest: "artifact-before" }, repository, { replan: async () => ({}), reauthorize: async () => true }, 3, {}, new Date("2026-09-03T16:00:00.000Z"), undefined, leases), /tcx_drift_requires_atomic_authority/);
});

test("drift recovery stops when AEGIS reauthorization denies the new attempt", async () => {
  const repository = new InMemoryExecutionTransactionRepository();
  const original = transaction();
  await repository.create(original);
  const mutated = await repository.update({ ...original, state: "EXECUTION_FAILED", artifactDigest: "artifact-2" }, original.stateVersion);
  const result = await recoverFromTcxDrift(mutated.transactionId, original, repository, { replan: async () => ({}), reauthorize: async () => false }, 2, {}, new Date("2026-09-03T16:00:00.000Z"));
  assert.equal(result.replanned, true);
  assert.equal(result.reauthorized, false);
  assert.equal(result.transaction.state, "RETRY_PENDING");
});

test("drift recovery respects max attempts", async () => {
  const repository = new InMemoryExecutionTransactionRepository();
  const original = transaction();
  await repository.create(original);
  const retryable = await repository.update({ ...original, state: "EXECUTION_FAILED", attemptNumber: 2 }, original.stateVersion);
  await assert.rejects(recoverFromTcxDrift(retryable.transactionId, original, repository, { replan: async () => ({}), reauthorize: async () => true }, 2), /execution_transaction_max_attempts_exceeded/);
});

test("in-memory TCX authority rejects a lease bound to another transaction", async () => {
  const authority = new InMemoryTcxExecutionFenceController();
  const leases = new InMemoryTcxLeaseRepository();
  await leases.put({ leaseId: "lease-mismatch-1", transactionId: "transaction-a", attemptId: "attempt-a", holderId: "node-1", issuedAt: "2026-09-03T15:00:00.000Z", expiresAt: "2026-09-03T17:00:00.000Z" });
  await assert.rejects(authority.fenceAndRevokeLease("transaction-b", "attempt-a", "lease-mismatch-1", "drift", "2026-09-03T16:00:00.000Z", leases), /tcx_lease_transaction_mismatch/);
  assert.equal(await authority.get("transaction-b", "attempt-a"), undefined);
  assert.equal((await leases.get("lease-mismatch-1"))?.revokedAt, undefined);
});

test("in-memory TCX authority rejects a lease bound to another attempt", async () => {
  const authority = new InMemoryTcxExecutionFenceController();
  const leases = new InMemoryTcxLeaseRepository();
  await leases.put({ leaseId: "lease-mismatch-2", transactionId: "transaction-a", attemptId: "attempt-a", holderId: "node-1", issuedAt: "2026-09-03T15:00:00.000Z", expiresAt: "2026-09-03T17:00:00.000Z" });
  await assert.rejects(authority.fenceAndRevokeLease("transaction-a", "attempt-b", "lease-mismatch-2", "drift", "2026-09-03T16:00:00.000Z", leases), /tcx_lease_attempt_mismatch/);
  assert.equal(await authority.get("transaction-a", "attempt-b"), undefined);
  assert.equal((await leases.get("lease-mismatch-2"))?.revokedAt, undefined);
});