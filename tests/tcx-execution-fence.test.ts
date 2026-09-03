import test from "node:test";
import assert from "node:assert/strict";
import { InMemoryTcxExecutionFenceController } from "../lib/hoare/execution/tcx-execution-fence";
import type { TcxExecutionFenceController } from "../lib/hoare/execution/tcx-execution-fence";
import { RedisTcxExecutionFenceController } from "../lib/hoare/execution/redis-tcx-execution-fence";
import { InMemoryTcxLeaseRepository } from "../lib/hoare/execution/tcx-dispatch-governance";
import { InMemoryExecutionTransactionRepository } from "../lib/hoare/execution/transaction-repository";
import { createExecutionTransaction } from "../lib/hoare/execution/transaction";
import { recoverFromTcxDrift } from "../lib/hoare/execution/tcx-drift-recovery";

function transaction() {
  return createExecutionTransaction({
    tenantId: "tenant-1", projectId: "project-1", releaseDigest: "release-1", artifactDigest: "artifact-1",
    artifactRef: "artifact://1", pasorPlanHash: "plan-1", pasorUnitId: "unit-1", workloadId: "workload-1",
    agentId: "agent-1", nodeId: "node-1", packId: "pack-1", runtimeKind: "python",
  });
}

test("execution fence is idempotent and blocks the fenced attempt", async () => {
  const fences = new InMemoryTcxExecutionFenceController();
  await fences.assertActive("tx-1", "attempt-1");
  const first = await fences.fence("tx-1", "attempt-1", "state_version_drift");
  const second = await fences.fence("tx-1", "attempt-1", "different_reason");
  assert.deepEqual(second, first);
  await assert.rejects(() => fences.assertActive("tx-1", "attempt-1"), /tcx_execution_fenced:state_version_drift/);
});

test("Redis fence authority satisfies the asynchronous TCX fence contract", () => {
  const fences: TcxExecutionFenceController = new RedisTcxExecutionFenceController();
  assert.ok(fences);
});

test("active RUNNING drift fences execution and revokes its lease before repair", async () => {
  const repository = new InMemoryExecutionTransactionRepository();
  const fences = new InMemoryTcxExecutionFenceController();
  const leases = new InMemoryTcxLeaseRepository();
  const original = { ...transaction(), state: "RUNNING" as const, leaseId: "lease-1" };
  await repository.create(original);
  await leases.put({ leaseId: "lease-1", transactionId: original.transactionId, attemptId: original.attemptId, holderId: "executor-1", issuedAt: "2026-09-03T15:59:00.000Z", expiresAt: "2026-09-03T17:00:00.000Z" });
  const mutated = await repository.update({ ...original, artifactDigest: "artifact-2" }, original.stateVersion);

  const result = await recoverFromTcxDrift(
    mutated.transactionId, original, repository,
    { replan: async () => ({ artifactDigest: "artifact-3" }), reauthorize: async () => true },
    3, {}, new Date("2026-09-03T16:00:00.000Z"), fences, leases,
  );

  assert.equal(result.transaction.state, "AUTHORIZED");
  assert.equal(result.transaction.attemptNumber, 2);
  await assert.rejects(() => fences.assertActive(original.transactionId, original.attemptId), /tcx_execution_fenced/);
  const revoked = await leases.get("lease-1");
  assert.equal(revoked?.revokedAt, "2026-09-03T16:00:00.000Z");
});

test("active drift without a fence controller fails closed", async () => {
  const repository = new InMemoryExecutionTransactionRepository();
  const original = transaction();
  const running = { ...original, state: "RUNNING" as const };
  await repository.create(running);
  const mutated = await repository.update({ ...running, artifactDigest: "artifact-2" }, running.stateVersion);

  await assert.rejects(
    recoverFromTcxDrift(mutated.transactionId, original, repository, { replan: async () => ({}), reauthorize: async () => true }, 3),
    /tcx_drift_requires_execution_fence:RUNNING/,
  );
});
