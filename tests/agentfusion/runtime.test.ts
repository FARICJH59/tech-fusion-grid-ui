import test from "node:test";
import assert from "node:assert/strict";

import { AgentRuntime } from "../../agentfusion";
import type { Agent } from "../../packages/agent-sdk/src/agent";

function buildAgent(): Agent {
  return {
    identity: { id: "beauty-agent", name: "Beauty", version: "1.0.0", description: "desc" },
    purpose: { mission: "recommend", domain: "beauty", objectives: ["recommend"] },
    capabilities: {
      supportedActions: ["recommend"], supportedTools: ["beauty-tool"], supportedWorkflows: ["beauty-flow"],
      registered: [{ id: "beauty", name: "Beauty", description: "", type: "reasoning", version: "1.0.0", actions: ["recommend"], tools: ["beauty-tool"], workflows: ["beauty-flow"] }],
    },
    tools: [{ id: "beauty-tool", name: "Beauty Tool", description: "", category: "api", permissions: ["beauty-read"] }],
    memory: { requiredMemoryType: "hybrid", storageAdapter: "agentfusion", retentionPolicy: { strategy: "session" }, namespaces: ["ctx"] },
    permissions: [{ id: "beauty-read", resource: "catalog", action: "read-status", description: "", requiredRole: "viewer", tenantScope: "current-tenant", securityPolicies: ["rbac"], auditRequired: true, attributes: { scope: "read" } }],
    workflows: [{ id: "beauty-flow", name: "Beauty", version: "1.0.0", description: "", collaborationMode: "single-agent", approvalMode: "none", eventStrategy: "summary-only", steps: [{ id: "task", name: "Task", type: "task" }] }],
    evaluation: { tests: [{ id: "t", name: "t", type: "capability" }], metrics: ["successRate"], qualityScoring: "weighted-balanced" },
  };
}

test("runtime executes registered agents in isolated tenant context", async () => {
  const runtime = new AgentRuntime();
  runtime.executor.registerTool({
    id: "beauty-tool",
    name: "Beauty Tool",
    description: "",
    category: "api",
    inputSchema: { type: "object" },
    outputSchema: { type: "object" },
    permissions: [{ id: "beauty-read", resource: "catalog", action: "read-status", description: "", requiredRole: "viewer", tenantScope: "current-tenant", securityPolicies: ["rbac"], auditRequired: true, attributes: { scope: "read" } }],
    execute: async (input) => ({ ok: true, input }),
  });

  const agent = buildAgent();
  const context = runtime.createContext(agent, {
    requestId: "req-1",
    tenant: { tenantId: "tenant-1" },
    actor: { id: "viewer-1", role: "viewer", type: "user" },
    metadata: { tokenUsage: 42 },
  });

  await runtime.loadAgent({ tenantId: "tenant-1", agent, context });
  await runtime.validateAgent(agent, "tenant-1", { ...context, actor: { ...context.actor, role: "admin" } });
  await runtime.lifecycle.activateAgent(agent.identity.id, "tenant-1", { ...context, actor: { ...context.actor, role: "admin" } }, agent.identity.version);
  runtime.registerExecutionHandler(agent.identity.id, async ({ payload }) => ({ payload, handled: true }));

  const result = await runtime.executeAgent({
    agentId: agent.identity.id,
    tenantId: "tenant-1",
    context,
    payload: { tone: "warm" },
    toolCalls: [{ toolId: "beauty-tool", input: { sku: "1" } }],
  });

  assert.equal(result.status, "completed");
  assert.equal(result.toolResults.length, 1);
  assert.equal(runtime.status("tenant-1").executions, 1);
});
