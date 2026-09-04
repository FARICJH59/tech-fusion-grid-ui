import test from "node:test";
import assert from "node:assert/strict";
import { AgentRuntime } from "../../agentfusion/runtime/agent-runtime";
import type { Agent } from "../../packages/agent-sdk/src/agent";
import type { AgentExecutionContext } from "../../packages/agent-sdk/src/context";
import { InMemoryTcxExecutionFenceController } from "../../lib/hoare/execution/tcx-execution-fence";

function buildAgent(): Agent {
  return {
    identity: { id: "governed-agent", name: "Governed Agent", version: "1.0.0", description: "test" },
    purpose: { mission: "execute", domain: "enterprise", objectives: ["execute"] },
    capabilities: { supportedActions: ["execute"], supportedTools: [], supportedWorkflows: [], registered: [{ id: "execute", name: "Execute", description: "", type: "automation", version: "1.0.0", actions: ["execute"], tools: [], workflows: [] }] },
    tools: [],
    memory: { requiredMemoryType: "hybrid", storageAdapter: "agentfusion", retentionPolicy: { strategy: "session" }, namespaces: ["ctx"] },
    permissions: [{ id: "execute", resource: "agent", action: "execute", description: "", requiredRole: "viewer", tenantScope: "current-tenant", securityPolicies: ["rbac"], auditRequired: true }],
    workflows: [{ id: "execute-flow", name: "Execute Flow", version: "1.0.0", description: "", collaborationMode: "single-agent", approvalMode: "none", eventStrategy: "summary-only", steps: [{ id: "step-1", name: "Execute", type: "task" }] }],
    evaluation: { tests: [{ id: "t", name: "t", type: "capability" }], metrics: ["successRate"], qualityScoring: "weighted-balanced" },
  };
}
function context(requestId: string): AgentExecutionContext {
  return { requestId, tenant: { tenantId: "tenant-1" }, actor: { id: "viewer-1", role: "viewer", type: "user" } };
}

test("AgentRuntime governed execution delegates through executeGoverned with TCX context", async () => {
  const runtime = new AgentRuntime();
  const agent = buildAgent();
  await runtime.registry.register({ tenantId: "tenant-1", agent });
  const fenceController = new InMemoryTcxExecutionFenceController();
  let handlerCalled = false;
  runtime.registerExecutionHandler(agent.identity.id, async () => { handlerCalled = true; await fenceController.assertActive("tx-1", "attempt-1"); return { ok: true }; });
  const result = await runtime.executeAgentGoverned({ agentId: agent.identity.id, tenantId: "tenant-1", context: context("req-governed-runtime"), payload: { source: "tcx" } }, { transactionId: "tx-1", attemptId: "attempt-1", fenceController });
  assert.equal(handlerCalled, true);
  assert.equal(result.status, "completed");
  assert.deepEqual(result.output, { ok: true });
});

test("AgentRuntime governed execution fails closed when the TCX attempt is fenced", async () => {
  const runtime = new AgentRuntime();
  const agent = buildAgent();
  await runtime.registry.register({ tenantId: "tenant-1", agent });
  const fenceController = new InMemoryTcxExecutionFenceController();
  await fenceController.fence("tx-2", "attempt-2", "test-revocation");
  let handlerCalled = false;
  runtime.registerExecutionHandler(agent.identity.id, async () => { handlerCalled = true; return { ok: true }; });
  const result = await runtime.executeAgentGoverned({ agentId: agent.identity.id, tenantId: "tenant-1", context: context("req-governed-fenced") }, { transactionId: "tx-2", attemptId: "attempt-2", fenceController });
  assert.equal(handlerCalled, false);
  assert.equal(result.status, "failed");
  assert.match(result.error ?? "", /tcx_execution_fenced/);
});
