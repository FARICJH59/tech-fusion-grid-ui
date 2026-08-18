import assert from "node:assert/strict";
import test from "node:test";
import { evaluateTenantExecutionScope, TenantExecutionScope } from "./tenant-execution-scope";

const scope: TenantExecutionScope = {
  tenantId: "tenant-acme",
  projectId: "commerce-prod",
  targetId: "checkout-api",
  environment: "production",
  resourceId: "cloud-run:checkout-api",
  provider: "gcp",
  policyVersion: "v1",
  authorizedActions: ["runtime.restart", "runtime.scale"],
};

test("authorizes an action inside the tenant/project/resource scope", () => {
  const decision = evaluateTenantExecutionScope(scope, "runtime.restart");
  assert.equal(decision.allowed, true);
  assert.equal(decision.reason, "TENANT_SCOPE_AUTHORIZED");
  assert.match(decision.scopeHash, /^[a-f0-9]{64}$/);
});

test("rejects an action outside the tenant policy", () => {
  const decision = evaluateTenantExecutionScope(scope, "runtime.rollback");
  assert.equal(decision.allowed, false);
  assert.equal(decision.reason, "TENANT_ACTION_NOT_AUTHORIZED");
});

test("rejects incomplete tenant scope", () => {
  const decision = evaluateTenantExecutionScope({ ...scope, projectId: "" }, "runtime.restart");
  assert.equal(decision.allowed, false);
  assert.equal(decision.reason, "TENANT_SCOPE_INCOMPLETE");
});
