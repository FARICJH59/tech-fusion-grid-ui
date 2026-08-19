import assert from "node:assert/strict";
import test from "node:test";

import { createHoareBuilderPlan } from "../lib/enterprise/hoare-builder-planner";

test("HOARE builder detects document workloads and creates least-privilege IAM intent", () => {
  const plan = createHoareBuilderPlan({
    tenantId: "tenant-a",
    projectId: "translator-a",
    description: "Build a secure enterprise document translation service",
    environment: "production",
    providers: ["aws"],
    domain: "translate.example.test",
    autonomy: "policy-autonomous",
  });

  assert.equal(plan.architecture.workloadClass, "document");
  assert.equal(plan.architecture.modelStrategy, "provider-neutral");
  assert.equal(plan.architecture.identityStrategy, "temporary-credentials");
  assert.equal(plan.architecture.policyStrategy, "least-privilege");
  assert.equal(plan.iam[0]?.roleBoundary, "tenant-agent");
  assert.equal(plan.iam[0]?.credentialStrategy, "temporary");
  assert.ok(plan.iam[0]?.permissions.includes("translation.invoke"));
  assert.ok(plan.iam[0]?.forbidden.includes("iam.*"));
  assert.equal(plan.validation.productionApprovalRequired, true);
  assert.equal(plan.validation.longLivedCredentialsAllowed, false);
});

test("HOARE builder keeps provider selection separate from model selection", () => {
  const plan = createHoareBuilderPlan({
    tenantId: "tenant-b",
    projectId: "vision-a",
    description: "Build an edge vision camera agent",
    environment: "development",
    providers: ["aws", "gcp", "azure"],
    autonomy: "policy-autonomous",
  });

  assert.equal(plan.architecture.workloadClass, "vision");
  assert.equal(plan.architecture.modelStrategy, "provider-neutral");
  assert.equal(plan.iam.length, 3);
  assert.equal(plan.validation.providerNeutral, true);
  assert.equal(plan.validation.productionApprovalRequired, false);
});
