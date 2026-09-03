import test from "node:test";
import assert from "node:assert/strict";
import { createExecutionTransaction } from "../lib/hoare/execution/transaction";
import { InMemoryExecutionTransactionRepository } from "../lib/hoare/execution/transaction-repository";
import { InMemoryTcxLeaseRepository } from "../lib/hoare/execution/tcx-dispatch-governance";
import { buildTcxPreconditionHash } from "../lib/hoare/execution/tcx-governance";
import { finalizeTcxCommit } from "../lib/hoare/execution/tcx-commit-finalizer";
import type { ExecutionTransaction } from "../lib/hoare/execution/transaction";
import type { ExecutionEvidenceEnvelope } from "../lib/hoare/execution/evidence-envelope";
import { createHash } from "node:crypto";

const NOW = new Date("2026-09-03T17:00:00.000Z");

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function hashPayload(payload: Record<string, unknown>, field: string): string {
  const copy = Object.fromEntries(Object.entries(payload).filter(([key]) => key !== field));
  return createHash("sha256").update(canonical(copy)).digest("hex");
}

function makeEvidence(transaction: ExecutionTransaction, preconditionHash: string): ExecutionEvidenceEnvelope {
  const receipt = { receipt_id: "receipt-1", receipt_hash: "" };
  receipt.receipt_hash = hashPayload(receipt, "receipt_hash");
  const result = {
    result_id: "result-1",
    receipt_id: receipt.receipt_id,
    receipt_hash: receipt.receipt_hash,
    workload_id: transaction.workloadId,
    agent_id: transaction.agentId,
    node_id: transaction.nodeId,
    pack_id: transaction.packId,
    runtime_kind: transaction.runtimeKind,
    output: { ok: true },
    result_hash: "",
  };
  result.result_hash = hashPayload(result, "result_hash");
  const attestation = {
    attestation_id: "attestation-1",
    receipt_id: receipt.receipt_id,
    receipt_hash: receipt.receipt_hash,
    result_id: result.result_id,
    result_hash: result.result_hash,
    workload_id: transaction.workloadId,
    agent_id: transaction.agentId,
    node_id: transaction.nodeId,
    pack_id: transaction.packId,
    runtime_kind: transaction.runtimeKind,
    attestation_hash: "",
  };
  attestation.attestation_hash = hashPayload(attestation, "attestation_hash");
  return {
    schema: "hoare.execution-evidence/v1",
    transactionId: transaction.transactionId,
    attemptId: transaction.attemptId,
    tenantId: transaction.tenantId,
    nodeId: transaction.nodeId,
    stateVersion: transaction.stateVersion,
    preconditionHash,
    receipt,
    result,
    attestation,
    status: "SUCCEEDED",
    correlationId: transaction.transactionId,
    emittedAt: NOW.toISOString(),
  };
}

async function setup() {
  const transactions = new InMemoryExecutionTransactionRepository();
  const leases = new InMemoryTcxLeaseRepository();
  const base = createExecutionTransaction({
    transactionId: "tx-commit-1", tenantId: "tenant-1", projectId: "project-1",
    releaseDigest: "sha256:release", artifactDigest: "sha256:artifact", artifactRef: "artifact://one",
    pasorPlanHash: "sha256:plan", pasorUnitId: "unit-1", workloadId: "workload-1", agentId: "agent-1",
    nodeId: "node-1", packId: "pack-1", runtimeKind: "python", leaseId: "lease-1",
  });
  await transactions.create(base);
  const authorized = await transactions.transition(base.transactionId, "CREATED", "AUTHORIZED", 1);
  const dispatched = await transactions.transition(base.transactionId, "AUTHORIZED", "DISPATCHED", authorized.stateVersion);
  const admitted = await transactions.transition(base.transactionId, "DISPATCHED", "ADMITTED", dispatched.stateVersion);
  const running = await transactions.transition(base.transactionId, "ADMITTED", "RUNNING", admitted.stateVersion);
  const preconditionHash = buildTcxPreconditionHash({ ...running, stateVersion: authorized.stateVersion });
  const withPrecondition = await transactions.update({ ...running, preconditionHash }, running.stateVersion);
  await leases.put({ leaseId: "lease-1", transactionId: base.transactionId, attemptId: base.attemptId, holderId: "edge-1", issuedAt: "2026-09-03T16:59:00.000Z", expiresAt: "2026-09-03T17:05:00.000Z" });
  return { transactions, leases, transaction: withPrecondition, preconditionHash };
}

test("TCX commit finalizer verifies evidence, lease, precondition, and commits success", async () => {
  const ctx = await setup();
  const evidence = makeEvidence(ctx.transaction, ctx.preconditionHash);
  const result = await finalizeTcxCommit(evidence, ctx, NOW);
  assert.equal(result.duplicate, false);
  assert.equal(result.transaction.state, "SUCCEEDED");
  assert.ok(result.transaction.commitRecordHash);
  assert.equal(result.commitRecord.preconditionHash, ctx.preconditionHash);
  assert.ok(result.commitRecord.postconditionHash);
});

test("TCX commit rejects missing evidence precondition", async () => {
  const ctx = await setup(); const evidence = makeEvidence(ctx.transaction, ctx.preconditionHash); delete evidence.preconditionHash;
  await assert.rejects(finalizeTcxCommit(evidence, ctx, NOW), /tcx_commit_evidence_precondition_missing/);
});

test("TCX commit rejects cross-attempt evidence", async () => {
  const ctx = await setup(); const evidence = makeEvidence(ctx.transaction, ctx.preconditionHash); evidence.attemptId = "other-attempt";
  await assert.rejects(finalizeTcxCommit(evidence, ctx, NOW), /tcx_commit_attempt_mismatch/);
});

test("TCX commit rejects a revoked lease without mutating the transaction", async () => {
  const ctx = await setup(); await ctx.leases.revoke("lease-1", NOW.toISOString());
  const before = await ctx.transactions.get(ctx.transaction.transactionId); const evidence = makeEvidence(ctx.transaction, ctx.preconditionHash);
  await assert.rejects(finalizeTcxCommit(evidence, ctx, NOW), /tcx_lease_revoked/);
  const after = await ctx.transactions.get(ctx.transaction.transactionId);
  assert.equal(after?.state, before?.state); assert.equal(after?.stateVersion, before?.stateVersion);
});

test("TCX commit rejects a mismatched precondition", async () => {
  const ctx = await setup(); const evidence = makeEvidence(ctx.transaction, "wrong-precondition");
  await assert.rejects(finalizeTcxCommit(evidence, ctx, NOW), /tcx_precondition_mismatch/);
});

test("TCX commit fences an intervening transaction mutation by evidence state version", async () => {
  const ctx = await setup(); const evidence = makeEvidence(ctx.transaction, ctx.preconditionHash);
  const current = await ctx.transactions.get(ctx.transaction.transactionId); assert.ok(current);
  await ctx.transactions.update({ ...current, provenanceHash: "changed" }, current.stateVersion);
  await assert.rejects(finalizeTcxCommit(evidence, ctx, NOW), /tcx_commit_state_version_mismatch/);
});
