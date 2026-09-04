import { describe, expect, it, vi } from "vitest";
import { AgentFusionHoareRuntime, type HoareAdmissionGate } from "./agentfusion-runtime";

function agent() {
  return { identity: { id: "agent-1" } } as never;
}
function context() {
  return { phase: "act", observations: [{ id: "o1", tenantId: "tenant-1", source: "test", type: "test", data: {}, observedAt: new Date(0).toISOString() }], decisions: [], cycle: 1 } as never;
}

describe("AgentFusionHoareRuntime admission boundary", () => {
  it("executes only after TCX admission", async () => {
    const executeAgent = vi.fn().mockResolvedValue({ status: "completed", output: {} });
    const gate: HoareAdmissionGate = { admit: vi.fn().mockResolvedValue({ admitted: true, reason: "admitted" } as never) };
    const runtime = new AgentFusionHoareRuntime(
      { executeAgent } as never,
      { resolve: vi.fn().mockResolvedValue(agent()) },
      { create: vi.fn().mockReturnValue({}) },
      "agent-1",
      gate,
    );

    const result = await runtime.execute({ decision: { action: "build", reason: "test", confidence: 1 }, context: context() });
    expect(result.success).toBe(true);
    expect(gate.admit).toHaveBeenCalledOnce();
    expect(executeAgent).toHaveBeenCalledOnce();
  });

  it("fails closed and never executes when TCX admission is denied", async () => {
    const executeAgent = vi.fn();
    const gate: HoareAdmissionGate = { admit: vi.fn().mockResolvedValue({ admitted: false, reason: "proof_failed" } as never) };
    const runtime = new AgentFusionHoareRuntime(
      { executeAgent } as never,
      { resolve: vi.fn().mockResolvedValue(agent()) },
      { create: vi.fn().mockReturnValue({}) },
      "agent-1",
      gate,
    );

    const result = await runtime.execute({ decision: { action: "build", reason: "test", confidence: 1 }, context: context() });
    expect(result.success).toBe(false);
    expect(result.detail).toContain("TCX admission denied");
    expect(executeAgent).not.toHaveBeenCalled();
  });
});
