import test from "node:test";
import assert from "node:assert/strict";

import { AgentExecutor } from "../../agentfusion/runtime/agent-executor";
import type { Agent } from "../../packages/agent-sdk/src/agent";

function buildAgent(): Agent {
  return {
    identity: { id: "exec-agent", name: "Executor", version: "1.0.0", description: "desc" },
    purpose: { mission: "execute", domain: "enterprise", objectives: ["execute"] },
    capabilities: {
      supportedActions: ["execute"],
      supportedTools: [],
      supportedWorkflows: [],
      registered: [{ id: "exec", name: "Executor", description: "", type: "automation", version: "1.0.0", actions: ["execute"], tools: [], workflows: [] }],
    },
    tools: [],
    memory: { requiredMemoryType: "hybrid", storageAdapter: "agentfusion", retentionPolicy: { strategy: "session" }, namespaces: ["ctx"] },
    permissions: [{ id: "execute", resource: "agent", action: "execute", description: "", requiredRole: "viewer", tenantScope: "current-tenant", securityPolicies: ["rbac"], auditRequired: true }],
    workflows: [],
    evaluation: { tests: [{ id: "t", name: "t", type: "capability" }], metrics: ["successRate"], qualityScoring: "weighted-balanced" },
  };
}

const context = {
  requestId: "req-exec",
  tenant: { tenantId: "tenant-1" },
  actor: { id: "viewer-1", role: "viewer" as const, type: "user" as const },
};

test("execution runtime retries transient failures and traces attempts", async () => {
  const executor = new AgentExecutor();
  const agent = buildAgent();
  let tries = 0;

  const result = await executor.execute({
    agent,
    tenantId: "tenant-1",
    context,
    retryPolicy: { maxRetries: 1 },
    handler: async () => {
      tries += 1;
      if (tries === 1) throw new Error("transient");
      return { ok: true };
    },
  });

  assert.equal(result.status, "completed");
  assert.equal(executor.listTraces(agent.identity.id)[0]?.attempts, 2);
});

test("execution runtime supports asynchronous execution reads", async () => {
  const executor = new AgentExecutor();
  const agent = buildAgent();
  const handle = executor.executeAsync({
    agent,
    tenantId: "tenant-1",
    context: { ...context, requestId: "req-exec-async" },
    handler: async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
      return { ok: true };
    },
  });

  const firstRead = await executor.readAsyncResult(handle.executionId);
  assert.equal(firstRead.status, "running");

  await new Promise((resolve) => setTimeout(resolve, 30));
  const completed = await executor.readAsyncResult(handle.executionId);
  assert.equal(completed.status, "completed");
  assert.equal(completed.result?.status, "completed");
});
