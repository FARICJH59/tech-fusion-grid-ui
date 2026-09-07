import test from "node:test";
import assert from "node:assert/strict";
import { ToolRegistry } from "../../packages/agent-sdk/src/tool";

const context = {
  requestId: "req-governed-tool-test",
  tenant: { tenantId: "tenant-a" },
  actor: { id: "actor-a", role: "operator" as const, type: "service" as const },
};

function registerTool(registry: ToolRegistry, calls: { count: number }) {
  registry.register({ id: "test.side-effect", name: "Test side effect", description: "Test governed tool boundary", category: "cloud", inputSchema: { type: "object" }, outputSchema: { type: "object" }, permissions: [], async execute() { calls.count += 1; return { ok: true }; } });
}

test("governed tool execution rejects a forged authority before the tool runs", async () => {
  const registry = new ToolRegistry(); const calls = { count: 0 }; registerTool(registry, calls);
  await assert.rejects(registry.executeGoverned("test.side-effect", {}, { ...context, authority: { transactionId: "tx-1", attemptId: "attempt-1", tenantId: "tenant-a", leaseId: "lease-1", stateVersion: 3, authorizationDecisionId: "decision-1", verificationProofId: "proof-1", assertValid: async () => undefined } as never }), /tcx_execution_authority_not_issuer_created/);
  assert.equal(calls.count, 0);
});

test("governed tool execution does not accept a plain object even when it resembles authority", async () => {
  const registry = new ToolRegistry(); const calls = { count: 0 }; registerTool(registry, calls);
  await assert.rejects(registry.executeGoverned("test.side-effect", {}, { ...context, authority: { tenantId: "tenant-b", transactionId: "tx-1", attemptId: "attempt-1" } as never }), /tcx_execution_authority_not_issuer_created/);
  assert.equal(calls.count, 0);
});
