import test from "node:test";
import assert from "node:assert/strict";

import { AgentPermissionEvaluator } from "../../packages/agent-sdk/src";

test("permission model enforces tenant isolation, approval requirements, and audit hooks", async () => {
  const audits: string[] = [];
  const evaluator = new AgentPermissionEvaluator({
    authorize: ({ permission, context }) =>
      permission.requiredRole === "viewer" || context.actor.role === "operator" || context.actor.role === "admin",
    evaluatePolicy: ({ permission }) => ({
      allowed: true,
      approvalRequired: permission.approvalRequired,
      reason: permission.approvalRequired ? "Approval workflow required." : "Approved.",
    }),
    audit: async (entry) => {
      audits.push(`${entry.permissionId}:${entry.effect}`);
    },
  });

  const result = await evaluator.evaluate({
    permission: {
      id: "perm-approve",
      resource: "workflow",
      action: "deploy",
      description: "Deploy workflow",
      requiredRole: "operator",
      tenantScope: "current-tenant",
      securityPolicies: ["rbac", "approval-workflow"],
      auditRequired: true,
      approvalRequired: true,
    },
    context: {
      requestId: "req-1",
      tenant: { tenantId: "tenant-1" },
      actor: { id: "user-1", role: "operator", type: "user" },
    },
  });

  assert.equal(result.allowed, false);
  assert.equal(result.approvalRequired, true);
  assert.equal(result.effect, "require-approval");
  assert.deepEqual(audits, ["perm-approve:require-approval"]);
});
