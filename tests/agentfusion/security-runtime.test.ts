import test from "node:test";
import assert from "node:assert/strict";

import { AgentSecurityRuntime } from "../../agentfusion/security/security-runtime";

test("security runtime enforces tenant isolation and approval-aware authorization", async () => {
  const security = new AgentSecurityRuntime();
  const context = {
    requestId: "req-1",
    tenant: { tenantId: "tenant-1", organizationId: "org-1" },
    actor: { id: "viewer-1", role: "viewer" as const, type: "user" as const },
  };

  const allowed = await security.authorize({
    agentId: "agent-1",
    tenantId: "tenant-1",
    action: "read-status",
    resource: "catalog",
    context,
    requiredRole: "viewer",
    attributes: { scope: "read" },
  });
  const denied = await security.authorize({
    agentId: "agent-1",
    tenantId: "tenant-2",
    action: "read-status",
    resource: "catalog",
    context,
    requiredRole: "viewer",
    attributes: { scope: "read" },
  });

  assert.equal(allowed.allowed, true);
  assert.equal(denied.allowed, false);
  assert.equal(security.listAudit().length >= 2, true);
});
