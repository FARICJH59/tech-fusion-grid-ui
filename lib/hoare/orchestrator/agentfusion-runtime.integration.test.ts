import test from "node:test";
import assert from "node:assert/strict";
import { AgentFusionHoareRuntime, type HoareAdmissionGate } from "./agentfusion-runtime";
import { TcxHoareAdmissionGate } from "../admission/tcx-hoare-admission-gate";
import { InMemoryTcxLeaseRepository } from "../execution/tcx-dispatch-governance";
import { InMemoryTcxExecutionFenceController, type TcxExecutionFenceController } from "../execution/tcx-execution-fence";
import type { AgentExecutionContext } from "@/packages/agent-sdk/src/context";
import type { AuthorizationDecision, TCXTransaction, VerificationResult } from "@/packages/hoare-contracts/src";
import type { TcxLease } from "../execution/tcx-governance";

function agent() { return { identity: { id: "agent-1" } } as never; }
function context() { return { phase: "act", observations: [{ id: "o1", tenantId: "tenant-1", source: "test", type: "test", data: {}, observedAt: new Date(0).toISOString() }], decisions: [], cycle: 1 } as never; }
function agentExecutionContext(): AgentExecutionContext { return { requestId: "request-1", tenant: { tenantId: "tenant-1" }, actor: { id: "agent-1", role: "service", type: "agent" }, correlationId: "corr-1" }; }
function contextFactory() { return { create: (): AgentExecutionContext => agentExecutionContext() }; }
function fence(): TcxExecutionFenceController {
  return {
    get: async () => ({ transactionId: "tx-1", attemptId: "attempt-1", state: "ACTIVE" }),
    fence: async () => ({ transactionId: "tx-1", attemptId: "attempt-1", state: "FENCED" }),
    assertActive: async () => undefined,
  };
}
function admission(admitted: boolean) {
  return { transactionId: "tx-1", attemptId: "attempt-1", admitted, stateVersion: 1, leaseId: "lease-1", fenceValid: admitted, authorizationDecisionId: admitted ? "auth-1" : "", verificationProofId: admitted ? "proof-1" : "", admittedAt: new Date(0).toISOString(), reason: admitted ? "admitted" : "proof_failed" } as never;
}
function realAdmissionFixture() {
  const leases = new InMemoryTcxLeaseRepository();
  const fences = new InMemoryTcxExecutionFenceController();
  const transaction: TCXTransaction = { transactionId: "tx-1", attemptId: "attempt-1", tenantId: "tenant-1", agentId: "agent-1", leaseId: "lease-1", expectedStateVersion: 1, stateVersion: 1, idempotencyKey: "idem-1", state: "AUTHORIZED" };
  const authorization: AuthorizationDecision = { decisionId: "auth-1", requestId: "request-1", decision: "ALLOW", allowed: true, policyVersion: "test-policy-v1", reason: "test authorization", decidedAt: new Date(0).toISOString() };
  const verification: VerificationResult = { proofId: "proof-1", verified: true, verifier: "test-verifier", proofDigest: "proof-digest", verifiedAt: new Date(0).toISOString() };
  const lease: TcxLease = { leaseId: "lease-1", transactionId: "tx-1", attemptId: "attempt-1", holderId: "agent-1", issuedAt: new Date(0).toISOString(), expiresAt: new Date(Date.now() + 60_000).toISOString() };
  return { leases, fences, transaction, authorization, verification, lease };
}

function runtime(executeAgentGoverned: (...args: never[]) => Promise<unknown>, gate: HoareAdmissionGate, fences: TcxExecutionFenceController) {
  return new AgentFusionHoareRuntime({ executeAgentGoverned, executeAgent: async () => ({}) } as never, { resolve: async () => agent() }, contextFactory(), "agent-1", gate, fences);
}

test("AgentFusionHoareRuntime executes only after TCX admission and passes the immutable fence context", async () => {
  let admissionCalls = 0; let executionCalls = 0; let receivedTcx: unknown;
  const executeAgentGoverned = async (_request: unknown, tcx: unknown) => { executionCalls += 1; receivedTcx = tcx; return { status: "completed", output: {} }; };
  const gate: HoareAdmissionGate = { admit: async () => { admissionCalls += 1; return admission(true); } };
  const fences = fence();
  const result = await runtime(executeAgentGoverned as never, gate, fences).execute({ decision: { action: "build", reason: "test", confidence: 1 }, context: context() });
  assert.equal(result.success, true);
  assert.equal(admissionCalls, 1);
  assert.equal(executionCalls, 1);
  assert.deepEqual(receivedTcx, { transactionId: "tx-1", attemptId: "attempt-1", fenceController: fences });
});

test("AgentFusionHoareRuntime fails closed and never executes when TCX admission is denied", async () => {
  let executionCalls = 0;
  const executeAgentGoverned = async () => { executionCalls += 1; return { status: "completed" }; };
  const gate: HoareAdmissionGate = { admit: async () => admission(false) };
  const result = await runtime(executeAgentGoverned as never, gate, fence()).execute({ decision: { action: "build", reason: "test", confidence: 1 }, context: context() });
  assert.equal(result.success, false);
  assert.match(result.detail ?? "", /TCX admission denied/);
  assert.equal(executionCalls, 0);
});

test("AgentFusionHoareRuntime composes real AEGIS authorization, formal proof, TCX lease and fence admission", async () => {
  const fixture = realAdmissionFixture(); await fixture.leases.put(fixture.lease);
  const gate = new TcxHoareAdmissionGate({ leases: fixture.leases, fences: fixture.fences });
  const admitted = await gate.admit({ transaction: fixture.transaction, authorization: fixture.authorization, verification: fixture.verification, now: new Date() });
  assert.deepEqual({ transactionId: admitted.transactionId, attemptId: admitted.attemptId, admitted: admitted.admitted, stateVersion: admitted.stateVersion, leaseId: admitted.leaseId, fenceValid: admitted.fenceValid, authorizationDecisionId: admitted.authorizationDecisionId, verificationProofId: admitted.verificationProofId }, { transactionId: "tx-1", attemptId: "attempt-1", admitted: true, stateVersion: 1, leaseId: "lease-1", fenceValid: true, authorizationDecisionId: "auth-1", verificationProofId: "proof-1" });
});

test("AgentFusionHoareRuntime rejects an execution after the TCX fence is raised", async () => {
  const fixture = realAdmissionFixture(); await fixture.leases.put(fixture.lease);
  const gate = new TcxHoareAdmissionGate({ leases: fixture.leases, fences: fixture.fences }); await fixture.fences.fence("tx-1", "attempt-1", "drift-recovery");
  const denied = await gate.admit({ transaction: fixture.transaction, authorization: fixture.authorization, verification: fixture.verification, now: new Date() });
  assert.equal(denied.admitted, false); assert.equal(denied.fenceValid, false); assert.equal(denied.reason, "tcx_execution_fenced");
});
