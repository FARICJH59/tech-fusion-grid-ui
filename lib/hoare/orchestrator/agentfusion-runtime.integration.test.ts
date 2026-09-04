import { describe, expect, it, vi } from "vitest";
import { AgentFusionHoareRuntime, type HoareAdmissionGate } from "./agentfusion-runtime";
import { TcxHoareAdmissionGate } from "../admission/tcx-hoare-admission-gate";
import { InMemoryTcxLeaseRepository } from "../execution/tcx-dispatch-governance";
import { InMemoryTcxExecutionFenceController, type TcxExecutionFenceController } from "../execution/tcx-execution-fence";
import type { AuthorizationDecision, TCXTransaction, VerificationResult } from "@/packages/hoare-contracts/src";
import type { TcxLease } from "../execution/tcx-governance";

function agent() {
  return { identity: { id: "agent-1" } } as never;
}
function context() {
  return { phase: "act", observations: [{ id: "o1", tenantId: "tenant-1", source: "test", type: "test", data: {}, observedAt: new Date(0).toISOString() }], decisions: [], cycle: 1 } as never;
}
function fence(): TcxExecutionFenceController {
  return { get: vi.fn().mockResolvedValue(undefined), fence: vi.fn(), assertActive: vi.fn().mockResolvedValue(undefined) };
}
function admission(admitted: boolean) {
  return {
    transactionId: "tx-1",
    attemptId: "attempt-1",
    admitted,
    stateVersion: 1,
    leaseId: "lease-1",
    fenceValid: admitted,
    authorizationDecisionId: admitted ? "auth-1" : "",
    verificationProofId: admitted ? "proof-1" : "",
    admittedAt: new Date(0).toISOString(),
    reason: admitted ? "admitted" : "proof_failed",
  } as never;
}

function realAdmissionFixture() {
  const leases = new InMemoryTcxLeaseRepository();
  const fences = new InMemoryTcxExecutionFenceController();
  const transaction: TCXTransaction = {
    transactionId: "tx-1",
    attemptId: "attempt-1",
    tenantId: "tenant-1",
    agentId: "agent-1",
    leaseId: "lease-1",
    expectedStateVersion: 1,
    stateVersion: 1,
    idempotencyKey: "idem-1",
    state: "AUTHORIZED",
  };
  const authorization: AuthorizationDecision = {
    decisionId: "auth-1",
    requestId: "request-1",
    decision: "ALLOW",
    allowed: true,
    policyVersion: "test-policy-v1",
    reason: "test authorization",
    decidedAt: new Date(0).toISOString(),
  };
  const verification: VerificationResult = {
    proofId: "proof-1",
    verified: true,
    verifier: "test-verifier",
    proofDigest: "proof-digest",
    verifiedAt: new Date(0).toISOString(),
  };
  const lease: TcxLease = {
    leaseId: "lease-1",
    transactionId: "tx-1",
    attemptId: "attempt-1",
    holderId: "agent-1",
    issuedAt: new Date(0).toISOString(),
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
  };
  return { leases, fences, transaction, authorization, verification, lease };
}

describe("AgentFusionHoareRuntime admission boundary", () => {
  it("executes only after TCX admission and passes the immutable fence context", async () => {
    const executeAgentGoverned = vi.fn().mockResolvedValue({ status: "completed", output: {} });
    const gate: HoareAdmissionGate = { admit: vi.fn().mockResolvedValue(admission(true)) };
    const fences = fence();
    const runtime = new AgentFusionHoareRuntime(
      { executeAgentGoverned, executeAgent: vi.fn() } as never,
      { resolve: vi.fn().mockResolvedValue(agent()) },
      { create: vi.fn().mockReturnValue({}) },
      "agent-1",
      gate,
      fences,
    );

    const result = await runtime.execute({ decision: { action: "build", reason: "test", confidence: 1 }, context: context() });
    expect(result.success).toBe(true);
    expect(gate.admit).toHaveBeenCalledOnce();
    expect(executeAgentGoverned).toHaveBeenCalledOnce();
    expect(executeAgentGoverned.mock.calls[0][1]).toEqual({ transactionId: "tx-1", attemptId: "attempt-1", fenceController: fences });
  });

  it("fails closed and never executes when TCX admission is denied", async () => {
    const executeAgentGoverned = vi.fn();
    const gate: HoareAdmissionGate = { admit: vi.fn().mockResolvedValue(admission(false)) };
    const runtime = new AgentFusionHoareRuntime(
      { executeAgentGoverned, executeAgent: vi.fn() } as never,
      { resolve: vi.fn().mockResolvedValue(agent()) },
      { create: vi.fn().mockReturnValue({}) },
      "agent-1",
      gate,
      fence(),
    );

    const result = await runtime.execute({ decision: { action: "build", reason: "test", confidence: 1 }, context: context() });
    expect(result.success).toBe(false);
    expect(result.detail).toContain("TCX admission denied");
    expect(executeAgentGoverned).not.toHaveBeenCalled();
  });

  it("composes real AEGIS authorization, formal proof, TCX lease and fence admission", async () => {
    const fixture = realAdmissionFixture();
    await fixture.leases.put(fixture.lease);
    const gate = new TcxHoareAdmissionGate({ leases: fixture.leases, fences: fixture.fences });

    const admitted = await gate.admit({
      transaction: fixture.transaction,
      authorization: fixture.authorization,
      verification: fixture.verification,
      now: new Date(),
    });

    expect(admitted).toMatchObject({
      transactionId: "tx-1",
      attemptId: "attempt-1",
      admitted: true,
      stateVersion: 1,
      leaseId: "lease-1",
      fenceValid: true,
      authorizationDecisionId: "auth-1",
      verificationProofId: "proof-1",
    });
  });

  it("rejects an execution after the TCX fence is raised", async () => {
    const fixture = realAdmissionFixture();
    await fixture.leases.put(fixture.lease);
    const gate = new TcxHoareAdmissionGate({ leases: fixture.leases, fences: fixture.fences });
    await fixture.fences.fence("tx-1", "attempt-1", "drift-recovery");

    const denied = await gate.admit({
      transaction: fixture.transaction,
      authorization: fixture.authorization,
      verification: fixture.verification,
      now: new Date(),
    });

    expect(denied.admitted).toBe(false);
    expect(denied.fenceValid).toBe(false);
    expect(denied.reason).toBe("tcx_execution_fenced");
  });
});
