import test from "node:test";
import assert from "node:assert/strict";

import { createExecutionTransaction } from "../lib/hoare/execution/transaction";
import {
  validateTcxLease,
  buildTcxPreconditionHash,
  assertTcxPrecondition,
  buildTcxCommitRecord,
} from "../lib/hoare/execution/tcx-governance";

function tx() {
  return createExecutionTransaction({
    tenantId: "tenant-1",
    projectId: "project-1",
    releaseDigest: "sha256:release",
    artifactDigest: "sha256:artifact",
    artifactRef: "artifact.tar",
    pasorPlanHash: "sha256:plan",
    pasorUnitId: "unit-1",
    workloadId: "workload-1",
    agentId: "agent-1",
    nodeId: "node-1",
    packId: "pack-1",
    runtimeKind: "python",
    channelId: "channel-1",
    leaseId: "lease-1",
  });
}

const lease = {
  leaseId: "lease-1",
  transactionId: "tx-1",
  attemptId: "attempt-1",
  holderId: "node-1",
  issuedAt: "2026-09-03T14:00:00.000Z",
  expiresAt: "2026-09-03T14:05:00.000Z",
};

test("expired lease fences execution", () => {
  const transaction = tx();
  Object.assign(transaction, { transactionId: "tx-1", attemptId: "attempt-1" });
  assert.throws(
    () => validateTcxLease(transaction, lease, new Date("2026-09-03T14:05:00.000Z")),
    /tcx_lease_expired/,
  );
});

test("revoked lease fences execution", () => {
  const transaction = tx();
  Object.assign(transaction, { transactionId: "tx-1", attemptId: "attempt-1" });
  assert.throws(
    () => validateTcxLease(transaction, { ...lease, revokedAt: "2026-09-03T14:03:00.000Z" }, new Date("2026-09-03T14:04:00.000Z")),
    /tcx_lease_revoked/,
  );
});

test("lease identity is bound to transaction attempt", () => {
  const transaction = tx();
  Object.assign(transaction, { transactionId: "tx-1", attemptId: "attempt-1" });
  assert.throws(
    () => validateTcxLease(transaction, { ...lease, attemptId: "old-attempt" }, new Date("2026-09-03T14:01:00.000Z")),
    /tcx_lease_identity_mismatch/,
  );
});

test("precondition hash binds transaction version and execution inputs", () => {
  const transaction = tx();
  const hash = buildTcxPreconditionHash(transaction);
  transaction.preconditionHash = hash;
  assert.doesNotThrow(() => assertTcxPrecondition(transaction, hash));
  transaction.stateVersion += 1;
  assert.throws(() => assertTcxPrecondition(transaction, buildTcxPreconditionHash(transaction)), /tcx_precondition_mismatch/);
});

test("commit record requires precondition and postcondition evidence", () => {
  assert.throws(
    () => buildTcxCommitRecord({ transactionId: "tx-1", attemptId: "a-1", stateVersion: 1, preconditionHash: "", postconditionHash: "post" }),
    /tcx_commit_evidence_incomplete/,
  );
  const record = buildTcxCommitRecord({ transactionId: "tx-1", attemptId: "a-1", stateVersion: 2, preconditionHash: "pre", postconditionHash: "post", receiptHash: "receipt" });
  assert.equal(record.transactionId, "tx-1");
  assert.equal(record.stateVersion, 2);
  assert.equal(record.postconditionHash, "post");
});
