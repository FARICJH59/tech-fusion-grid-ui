import test from "node:test";
import assert from "node:assert/strict";

import { AgentRegistry, type Agent } from "../../packages/agent-sdk/src";

function createAgent(): Agent {
  return {
    identity: {
      id: "industry-ops-agent",
      name: "Industry Ops Agent",
      version: "1.0.0",
      description: "Coordinates enterprise workflows through the Agent SDK.",
    },
    purpose: {
      mission: "Standardize enterprise automation contracts.",
      domain: "enterprise-operations",
      objectives: ["Preserve existing workflows", "Expose additive contracts"],
    },
    capabilities: {
      supportedActions: ["plan", "execute"],
      supportedTools: ["runtime-tool"],
      registered: [
        {
          id: "reasoning-core",
          name: "Reasoning Core",
          description: "Baseline reasoning capability.",
          type: "reasoning",
          version: "1.0.0",
          actions: ["plan"],
        },
      ],
      supportedWorkflows: ["workflow-a"],
    },
    tools: [
      {
        id: "runtime-tool",
        name: "Runtime Tool",
        description: "Tenant-safe runtime tool.",
        category: "enterprise",
        permissions: ["perm-runtime"],
      },
    ],
    memory: {
      requiredMemoryType: "hybrid",
      storageAdapter: "in-memory",
      retentionPolicy: { strategy: "session", ttlSeconds: 3600 },
      namespaces: ["workflow-context"],
    },
    permissions: [
      {
        id: "perm-runtime",
        resource: "runtime",
        action: "read-status",
        description: "Read runtime status.",
        requiredRole: "viewer",
        tenantScope: "current-tenant",
        securityPolicies: ["tenant-isolation", "rbac"],
        auditRequired: true,
        attributes: { scope: "read" },
      },
    ],
    workflows: [
      {
        id: "workflow-a",
        name: "Workflow A",
        version: "1.0.0",
        description: "Single workflow definition.",
        collaborationMode: "single-agent",
        approvalMode: "manual",
        eventStrategy: "emit-per-step",
        steps: [{ id: "step-1", name: "Step 1", type: "task" }],
      },
    ],
    evaluation: {
      tests: [{ id: "cap-test", name: "Capability Test", type: "capability" }],
      metrics: ["successRate", "latencyMs", "costUsd", "safetyScore", "reliabilityScore"],
      qualityScoring: "weighted-balanced",
    },
  };
}

test("agent interface registry loads and discovers agents", () => {
  const registry = new AgentRegistry();
  const agent = createAgent();

  const validation = registry.register(agent);

  assert.equal(validation.valid, true);
  assert.equal(registry.get("industry-ops-agent")?.identity.name, "Industry Ops Agent");
  assert.equal(registry.discoverByDomain("enterprise-operations").length, 1);
});
