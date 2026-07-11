import test from "node:test";
import assert from "node:assert/strict";

import { AgentFusionRegistry } from "../../agentfusion/registry/agent-registry";
import type { Agent } from "../../packages/agent-sdk/src/agent";

function buildAgent(version = "1.0.0"): Agent {
  return {
    identity: { id: "style-agent", name: "Style Agent", version, description: "desc" },
    purpose: { mission: "help", domain: "fashion", objectives: ["style"] },
    capabilities: {
      supportedActions: ["style"],
      supportedTools: ["lookup"],
      registered: [{ id: "style", name: "Style", description: "", type: "reasoning", version, actions: ["style"], tools: ["lookup"], workflows: ["style-flow"] }],
      supportedWorkflows: ["style-flow"],
    },
    tools: [{ id: "lookup", name: "Lookup", description: "", category: "api", permissions: ["style-read"] }],
    memory: {
      requiredMemoryType: "hybrid",
      storageAdapter: "agentfusion",
      retentionPolicy: { strategy: "session", ttlSeconds: 60 },
      namespaces: ["context"],
    },
    permissions: [{ id: "style-read", resource: "styles", action: "read-status", description: "", requiredRole: "viewer", tenantScope: "current-tenant", securityPolicies: ["tenant-isolation"], auditRequired: true }],
    workflows: [{ id: "style-flow", name: "Style Flow", version, description: "", collaborationMode: "single-agent", approvalMode: "none", eventStrategy: "summary-only", steps: [{ id: "step-1", name: "Step 1", type: "task" }] }],
    evaluation: { tests: [{ id: "t1", name: "test", type: "capability" }], metrics: ["successRate"], qualityScoring: "weighted-balanced" },
  };
}

test("agents register, version, discover, and expose capability metadata", async () => {
  const registry = new AgentFusionRegistry();
  await registry.register({ tenantId: "tenant-1", agent: buildAgent("1.0.0") });
  await registry.register({ tenantId: "tenant-1", agent: buildAgent("1.1.0"), status: "ACTIVE" });
  await registry.updateHealthStatus("tenant-1", "style-agent", "healthy", "1.1.0");

  const latest = registry.getRecord("tenant-1", "style-agent");
  assert.equal(latest?.version, "1.1.0");
  assert.equal(latest?.tenantScope, "current-tenant");
  assert.equal(registry.healthStatus("tenant-1", "style-agent"), "healthy");
  assert.deepEqual(registry.listVersions("tenant-1", "style-agent"), ["1.1.0", "1.0.0"]);
  assert.equal(registry.lookupCapabilities("tenant-1", "style-agent")[0], "style");
  assert.equal(registry.discover({ tenantId: "tenant-1", domain: "fashion", status: "ACTIVE" }).length, 1);
});
