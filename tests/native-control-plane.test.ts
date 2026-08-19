import assert from "node:assert/strict";
import test from "node:test";

import {
  HOARE_CONTROL_PLANE_LAYERS,
  createBuildPlan,
  isNativeControlPlanePlan,
} from "../lib/enterprise/native-control-plane";

test("native HOARE control plane exposes the canonical layers", () => {
  assert.ok(HOARE_CONTROL_PLANE_LAYERS.includes("identity"));
  assert.ok(HOARE_CONTROL_PLANE_LAYERS.includes("policy"));
  assert.ok(HOARE_CONTROL_PLANE_LAYERS.includes("model-selection"));
  assert.ok(HOARE_CONTROL_PLANE_LAYERS.includes("provider-adapters"));
  assert.ok(HOARE_CONTROL_PLANE_LAYERS.includes("domain-https"));
  assert.ok(HOARE_CONTROL_PLANE_LAYERS.includes("evidence"));
});

test("build plans remain provider-neutral and preserve approval boundaries", () => {
  const plan = createBuildPlan({
    tenantId: "tenant-test",
    projectId: "project-test",
    description: "Secure multi-tenant AI service",
    environment: "production",
    providers: ["aws", "gcp"],
    domain: "api.example.test",
    autonomy: "policy-autonomous",
  });

  assert.equal(plan.schema, "hoare.build-plan/v1");
  assert.deepEqual(plan.providerAdapters, ["aws", "gcp"]);
  assert.equal(plan.requiresApproval, true);
  assert.equal(
    plan.executionContract,
    "plan-validate-approve-execute-verify",
  );
  assert.equal(isNativeControlPlanePlan(plan), true);
});

test("non-production policy-autonomous plans can execute without forced approval", () => {
  const plan = createBuildPlan({
    tenantId: "tenant-test",
    projectId: "project-test",
    description: "Development agent service",
    environment: "development",
    autonomy: "policy-autonomous",
  });

  assert.equal(plan.requiresApproval, false);
  assert.equal(isNativeControlPlanePlan(plan), true);
});
