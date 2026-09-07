import assert from "node:assert/strict";
import test from "node:test";
import { TcxHoareAdmissionGate } from "../lib/hoare/admission/tcx-hoare-admission-gate";
import { InMemoryTcxExecutionFenceController } from "../lib/hoare/execution/tcx-execution-fence";
import { InMemoryTcxLeaseRepository } from "../lib/hoare/execution/tcx-dispatch-governance";
import { InMemoryExecutionTransactionRepository } from "../lib/hoare/execution/transaction-repository";
import type { ExecutionTransaction } from "../lib/hoare/execution/transaction";
import type { AuthorizationDecision, TCXTransaction, VerificationResult } from "../packages/hoare-contracts/src";

const NOW = new Date("2026-09-06T18:00:00.000Z");

function executionTransaction(): ExecutionTransaction {
  return {
    transactionId: "tx-1",
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
    idempotencyKey: "idem",
    state: "AUTHORIZED",
    stateVersion: 4,
    expectedStateVersion: 4,
    createdAt: NOW.toISOString(),
    updatedAt: NOW.toISOString(),
  };
}

function tcxTransaction(): TCXTransaction {
  return {
    transactionId: "tx-1",
    attemptId: "attempt-1",
    tenantId: "tenant-1",
    projectId: "project-1",
    agentId: "agent-1",
    leaseId: "lease-1",
    expectedStateVersion: 4,
    stateVersion: 4,
    idempotencyKey: "idem",
    state: "AUTHORIZED",
  };
}

function authorization(): AuthorizationDecision {
  return {
    decisionId: "decision-1",
    requestId: "request-1",
    decision: "ALLOW",
    allowed: true,
    policyVersion: "policy-1",
    reason: "allowed",
    decidedAt: NOW.toISOString(),
  };
}

function verification(): VerificationResult {
  return {
    proofId: "proof-1",
    verified: true,
    verifier: "verifier-1",
    proofDigest: "digest-1",
    verifiedAt: NOW.toISOString(),
  };
}

function gate() {
  const transactions = new InMemoryExecutionTransactionRepository();
  const leases = new InMemoryTcxLeaseRepository();
  const fences = new InMemoryTcxExecutionFenceController();
  return { transactions, leases, fences, gate: new TcxHoareAdmissionGate({ transactions, leases, fences }) };
}

async function provision() {
  const setup = gate();
  await setup.transactions.create(executionTransaction());
  await setup.leases.put({
    leaseId: "lease-1",
    transactionId: "tx-1",
    attemptId: "attempt-1",
    holderId: "agent-1",
    issuedAt: new Date(NOW.getTime() - 1_000).toISOString(),
    expiresAt: new Date(NOW.getTime() + 60_000).toISOString(),
  });
  return setup;
}

test("successful admission durably binds the AEGIS decision and proof", async () => {
  const { gate, transactions } = await provision();
  const admission = await gate.admit({ transaction: tcxTransaction(), authorization: authorization(), verification: verification(), now: NOW });

  assert.equal(admission.admitted, true);
  assert.equal(admission.authorizationDecisionId, "decision-1");
  assert.equal(admission.verificationProofId, "proof-1");
  const saved = await transactions.get("tx-1");
  assert.equal(saved?.authorizationDecisionId, "decision-1");
  assert.equal(saved?.verificationProofId, "proof-1");
  assert.equal(saved?.stateVersion, 5);
});

test("admission fails closed unless the transaction is AUTHORIZED", async () => {
  const { gate, transactions } = await provision();
  const admission = await gate.admit({ transaction: { ...tcxTransaction(), state: "CREATED" }, authorization: authorization(), verification: verification(), now: NOW });

  assert.equal(admission.admitted, false);
  assert.equal(admission.reason, "tcx_transaction_not_authorized");
  const saved = await transactions.get("tx-1");
  assert.equal(saved?.authorizationDecisionId, undefined);
});
