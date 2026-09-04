import test from "node:test";
import assert from "node:assert/strict";
import { TcxHoareAdmissionGate } from "./tcx-hoare-admission-gate";
import { InMemoryTcxExecutionFenceController } from "../execution/tcx-execution-fence";
import { InMemoryTcxLeaseRepository } from "../execution/tcx-dispatch-governance";
import type { AuthorizationDecision, TCXTransaction, VerificationResult } from "@/packages/hoare-contracts/src";

const now = new Date("2026-09-04T18:00:00.000Z");
const transaction: TCXTransaction = {
  transactionId: "tx-1", attemptId: "attempt-1", tenantId: "tenant-1", expectedStateVersion: 1,
  stateVersion: 1, idempotencyKey: "idem-1", leaseId: "lease-1", state: "AUTHORIZED",
};
const authorization: AuthorizationDecision = {
  decisionId: "auth-1", requestId: "request-1", decision: "ALLOW", allowed: true,
  policyVersion: "policy-v1", reason: "allowed", decidedAt: now.toISOString(),
};
const verification: VerificationResult = {
  proofId: "proof-1", verified: true, verifier: "aegis-test", proofDigest: "proof-digest",
  verifiedAt: now.toISOString(),
};

async function gateFor(lease = true) {
  const leases = new InMemoryTcxLeaseRepository();
  if (lease) await leases.put({ leaseId: "lease-1", transactionId: "tx-1", attemptId: "attempt-1", holderId: "agent-1", issuedAt: "2026-09-04T17:59:00.000Z", expiresAt: "2026-09-04T19:00:00.000Z" });
  return new TcxHoareAdmissionGate({ leases, fences: new InMemoryTcxExecutionFenceController() });
}

test("TcxHoareAdmissionGate admits only when authorization, proof, lease, state version and fence are valid", async () => {
  const result = await (await gateFor()).admit({ transaction, authorization, verification, now });
  assert.equal(result.admitted, true);
  assert.equal(result.fenceValid, true);
  assert.equal(result.transactionId, "tx-1");
  assert.equal(result.attemptId, "attempt-1");
});

test("TcxHoareAdmissionGate fails closed when authorization is denied", async () => {
  const result = await (await gateFor()).admit({ transaction, authorization: { ...authorization, allowed: false, decision: "DENY" }, verification, now });
  assert.equal(result.admitted, false);
  assert.equal(result.fenceValid, false);
  assert.equal(result.reason, "aegis_authorization_denied");
});

test("TcxHoareAdmissionGate fails closed when proof verification fails", async () => {
  const result = await (await gateFor()).admit({ transaction, authorization, verification: { ...verification, verified: false }, now });
  assert.equal(result.admitted, false);
  assert.equal(result.reason, "aegis_proof_verification_failed");
});

test("TcxHoareAdmissionGate fails closed when the lease is absent or invalid", async () => {
  const result = await (await gateFor(false)).admit({ transaction, authorization, verification, now });
  assert.equal(result.admitted, false);
  assert.equal(result.reason, "tcx_lease_not_found");
});

test("TcxHoareAdmissionGate fails closed when the execution fence is already fenced", async () => {
  const leases = new InMemoryTcxLeaseRepository();
  await leases.put({ leaseId: "lease-1", transactionId: "tx-1", attemptId: "attempt-1", holderId: "agent-1", issuedAt: "2026-09-04T17:59:00.000Z", expiresAt: "2026-09-04T19:00:00.000Z" });
  const fences = new InMemoryTcxExecutionFenceController();
  await fences.fence("tx-1", "attempt-1", "test-fence");
  const result = await new TcxHoareAdmissionGate({ leases, fences }).admit({ transaction, authorization, verification, now });
  assert.equal(result.admitted, false);
  assert.equal(result.reason, "tcx_execution_fenced");
});
