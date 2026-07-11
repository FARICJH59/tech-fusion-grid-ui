import test from "node:test";
import assert from "node:assert/strict";

import { AgentRuntime } from "../../agentfusion";
import type { Agent } from "../../packages/agent-sdk/src/agent";

function buildAgent(): Agent {
  return {
    identity: { id: "coord-agent", name: "Coordinator", version: "1.0.0", description: "desc" },
    purpose: { mission: "coordinate", domain: "enterprise", objectives: ["orchestrate"] },
    capabilities: {
      supportedActions: ["orchestrate"], supportedTools: [], supportedWorkflows: ["wf"],
      registered: [{ id: "coord", name: "Coord", description: "", type: "automation", version: "1.0.0", actions: ["orchestrate"], tools: [], workflows: ["wf"] }],
    },
    tools: [],
    memory: { requiredMemoryType: "hybrid", storageAdapter: "agentfusion", retentionPolicy: { strategy: "session" }, namespaces: ["ctx"] },
    permissions: [{ id: "manage", resource: "agent", action: "manage", description: "", requiredRole: "admin", tenantScope: "current-tenant", securityPolicies: ["rbac"], auditRequired: true, attributes: { scope: "admin" } }],
    workflows: [{ id: "wf", name: "Workflow", version: "1.0.0", description: "", collaborationMode: "single-agent", approvalMode: "none", eventStrategy: "summary-only", steps: [{ id: "start", name: "Start", type: "task" }] }],
    evaluation: { tests: [{ id: "t", name: "t", type: "capability" }], metrics: ["successRate"], qualityScoring: "weighted-balanced" },
  };
}

const context = {
  requestId: "req-1",
  tenant: { tenantId: "tenant-1" },
  actor: { id: "admin-1", role: "admin", type: "user" as const },
};

test("lifecycle manager enforces transitions and tenant-safe status changes", async () => {
  const runtime = new AgentRuntime();
  const agent = buildAgent();

  await runtime.loadAgent({ tenantId: "tenant-1", agent, context });
  await runtime.validateAgent(agent, "tenant-1", context);
  await runtime.lifecycle.activateAgent(agent.identity.id, "tenant-1", context, agent.identity.version);
  await runtime.lifecycle.pauseAgent(agent.identity.id, "tenant-1", context, agent.identity.version);
  const disabled = await runtime.lifecycle.disableAgent(agent.identity.id, "tenant-1", context, agent.identity.version);

  assert.equal(disabled.status, "DISABLED");
  assert.equal(runtime.registry.getRecord("tenant-1", agent.identity.id)?.status, "DISABLED");
});
