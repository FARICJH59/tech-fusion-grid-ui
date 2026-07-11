import test from "node:test";
import assert from "node:assert/strict";

import { createDefaultAgentFramework } from "../../lib/enterprise/agents";
import { HoareAgentAdapter } from "../../agentfusion/adapters/hoare-agent-adapter";

test("HOARE-Agent adapter exposes the existing framework through Agent SDK contracts", async () => {
  const framework = createDefaultAgentFramework();
  framework.createAgent({
    id: "hoare-runtime-agent",
    templateId: "runtime-operator",
    version: "1.0.0",
    status: "active",
    approvalsRequired: true,
  });

  const adapter = new HoareAgentAdapter({ framework });
  const agents = adapter.listAgents();
  const workflowRun = adapter.startWorkflow("hoare-runtime-agent", "approval-aware-operations");
  adapter.appendWorkflowEvent(workflowRun.id, "approval-requested");
  adapter.writeWorkflowMemory(workflowRun.id, "ticket", "INC-100");

  const permissionResult = await adapter.evaluatePermission(
    {
      id: "read-runtime",
      resource: "runtime-status",
      action: "read-status",
      description: "Read runtime status.",
      requiredRole: "viewer",
      tenantScope: "current-tenant",
      securityPolicies: ["tenant-isolation", "rbac"],
      auditRequired: true,
      attributes: { scope: "read" },
    },
    {
      requestId: "req-1",
      tenant: { tenantId: "tenant-1" },
      actor: { id: "user-1", role: "viewer", type: "user" },
    },
    "hoare-runtime-agent",
  );

  assert.equal(agents[0]?.identity.id, "hoare-runtime-agent");
  assert.equal(workflowRun.status, "running");
  assert.equal(framework.listWorkflows()[0]?.memory.ticket, "INC-100");
  assert.equal(permissionResult.allowed, true);
  assert.equal(adapter.integrationStatus().reasoningEngine, "preserved");
});
