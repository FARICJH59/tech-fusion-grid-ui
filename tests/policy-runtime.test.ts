import test from "node:test";
import assert from "node:assert/strict";

import { AutonomousPolicyEngine } from "../lib/policy/engine";
import { accessPolicyRegistry } from "../lib/security/access-policy";
import { tenantVault } from "../lib/security/tenant-vault";

test("policy runtime rejects high risk action above policy threshold", () => {
  const engine = new AutonomousPolicyEngine([
    {
      id: "scale-rule",
      version: 1,
      action: "scale",
      maxRiskLevel: "medium",
      allowAutoApprove: true,
      budgetGuardEnabled: true,
      requireTenantIsolation: true,
    },
  ]);

  const decision = engine.evaluate({
    id: "act-1",
    tenantId: "tenant-1",
    actionType: "scale",
    resource: "api",
    requestedBy: "agent",
    reason: "incident pressure",
    riskLevel: "critical",
    previousState: {},
    newState: { projectedCostUsd: 10, budgetLimitUsd: 20 },
    approvalStatus: "pending",
    executionStatus: "requested",
    timestamp: new Date().toISOString(),
  });

  assert.equal(decision.decision, "reject");
});

test("tenant vault enforces credential isolation", async () => {
  accessPolicyRegistry.set({
    tenantId: "tenant-1",
    secretName: "db-password",
    provider: "gcp-secret-manager",
    allowedRoles: ["security-admin"],
    leastPrivilege: true,
  });

  const writeDenied = await tenantVault.putSecret({
    tenantId: "tenant-1",
    provider: "gcp-secret-manager",
    secretName: "db-password",
    value: "v1",
    actorRole: "viewer",
    actor: "user-1",
  });

  const writeAllowed = await tenantVault.putSecret({
    tenantId: "tenant-1",
    provider: "gcp-secret-manager",
    secretName: "db-password",
    value: "v1",
    actorRole: "security-admin",
    actor: "user-2",
  });

  assert.equal(writeDenied, false);
  assert.equal(writeAllowed, true);
  assert.equal(
    tenantVault.getSecret({
      tenantId: "tenant-1",
      secretName: "db-password",
      actorRole: "security-admin",
      actor: "user-2",
    }),
    "v1",
  );
});
