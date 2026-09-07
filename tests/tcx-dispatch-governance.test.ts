import test from "node:test";
import assert from "node:assert/strict";

import { createExecutionTransaction } from "../lib/hoare/execution/transaction";
import { validateTcxLease } from "../lib/hoare/execution/tcx-governance";
import {
  InMemoryTcxDispatchIntentRepository,
  InMemoryTcxLeaseRepository,
  buildTcxDispatchKey,
  requireValidTcxLease,
} from "../lib/hoare/execution/tcx-dispatch-governance";

function transaction() {
  return createExecutionTransaction({
    transactionId: "tx-dispatch-1",
    attemptId: "attempt-1",
    tenantId: "tenant-1",
    projectId: "project-1",
    releaseDigest: "release",
    artifactDigest: "artifact",
    artifactRef: "artifact-ref",
    pasorPlanHash: "plan",
    pasorUnitId: "unit",
    workloadId: "workload",
    agentId: "agent",
    nodeId: "node",
    packId: "pack",
    runtimeKind: "python",
    leaseId: "lease-1",
  });
}

test("TCX lease is required and identity-fenced", async () => {
  const repository = new InMemoryTcxLeaseRepository();
  const tx = transaction();
  await assert.rejects(requireValidTcxLease(tx, repository), /tcx_lease_not_found/);

  const issuedAt = "2026-09-03T14:00:00.000Z";
  await repository.put({
    leaseId: "lease-1",
    transactionId: tx.transactionId,
    attemptId: tx.attemptId,
    holderId: "dispatcher-1",
    issuedAt,
    expiresAt: "2026-09-03T15:00:00.000Z",
  });

  const lease = await requireValidTcxLease(tx, repository, new Date("2026-09-03T14:30:00.000Z"));
  assert.equal(lease.leaseId, "lease-1");

  await repository.revoke("lease-1", "2026-09-03T14:31:00.000Z");
  await assert.rejects(
    requireValidTcxLease(tx, repository, new Date("2026-09-03T14:32:00.000Z")),
    /tcx_lease_revoked/,
  );
});

test("dispatch intent is idempotent per transaction attempt", async () => {
  const repository = new InMemoryTcxDispatchIntentRepository();
  const dispatchKey = buildTcxDispatchKey("tx-1", "attempt-1");
  const intent = {
    dispatchKey,
    transactionId: "tx-1",
    attemptId: "attempt-1",
    attemptNumber: 1,
    stateVersion: 4,
    idempotencyKey: "transaction:tx-1:attempt:attempt-1",
    status: "PENDING" as const,
    createdAt: "2026-09-03T14:00:00.000Z",
  };

  await repository.create(intent);
  assert.equal((await repository.create(intent)).status, "PENDING");
  assert.equal((await repository.claim(dispatchKey, "2026-09-03T14:00:01.000Z")).status, "CLAIMED");
  await assert.rejects(
    repository.claim(dispatchKey, "2026-09-03T14:00:02.000Z"),
    /tcx_dispatch_intent_claimed/,
  );

  await repository.markPublished(dispatchKey, "2026-09-03T14:00:03.000Z");
  assert.equal((await repository.get(dispatchKey))?.status, "PUBLISHED");
  assert.equal((await repository.claim(dispatchKey, "2026-09-03T14:00:04.000Z")).status, "PUBLISHED");
});

test("expired dispatch claim can be recovered", async () => {
  const repository = new InMemoryTcxDispatchIntentRepository();
  const dispatchKey = buildTcxDispatchKey("tx-2", "attempt-1");
  await repository.create({
    dispatchKey,
    transactionId: "tx-2",
    attemptId: "attempt-1",
    attemptNumber: 1,
    stateVersion: 1,
    idempotencyKey: "transaction:tx-2:attempt:attempt-1",
    status: "PENDING",
    createdAt: "2026-09-03T14:00:00.000Z",
  });

  await repository.claim(dispatchKey, "2026-09-03T14:00:00.000Z");
  const recovered = await repository.claim(dispatchKey, "2026-09-03T14:00:31.000Z");
  assert.equal(recovered.status, "CLAIMED");
  assert.equal(recovered.claimedAt, "2026-09-03T14:00:31.000Z");
});

test("lease validation rejects a cross-attempt lease", () => {
  assert.throws(
    () => validateTcxLease(
      { transactionId: "tx-1", attemptId: "attempt-2", leaseId: "lease-1" },
      {
        leaseId: "lease-1",
        transactionId: "tx-1",
        attemptId: "attempt-1",
        holderId: "dispatcher-1",
        issuedAt: "2026-09-03T14:00:00.000Z",
        expiresAt: "2026-09-03T15:00:00.000Z",
      },
      new Date("2026-09-03T14:30:00.000Z"),
    ),
    /tcx_lease_identity_mismatch/,
  );
});
