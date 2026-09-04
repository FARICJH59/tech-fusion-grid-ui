import { describe, expect, it, vi } from "vitest";
import { AgentFusionHoareRuntime, type HoareAdmissionGate } from "./agentfusion-runtime";
import type { TcxExecutionFenceController } from "../execution/tcx-execution-fence";

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
});
