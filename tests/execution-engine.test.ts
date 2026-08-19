import assert from "node:assert/strict";
import test from "node:test";

import { createBuildPlan } from "../lib/enterprise/native-control-plane";
import { createHoareBuilderPlan } from "../lib/enterprise/hoare-builder-planner";
import { createDeploymentPlan } from "../lib/enterprise/domain-https-planner";
import { prepareExecution } from "../lib/enterprise/execution-engine";

test("production execution stops before mutation without approval", () => {
  const intent = {
    tenantId: "tenant-a",
    projectId: "project-a",
    description: "Secure enterprise document translation service",
    environment: "production" as const,
    providers: ["aws" as const],
    domain: "translate.example.test",
    autonomy: "policy-autonomous" as const,
  };

  const result = prepareExecution({
    controlPlanePlan: createBuildPlan(intent),
    builderPlan: createHoareBuilderPlan(intent),
    deploymentPlan: createDeploymentPlan(intent),
    approved: false,
  });

  assert.equal(result.status, "blocked");
  assert.ok(result.reasons.includes("approval-required"));
  assert.deepEqual(result.completedStages, ["plan", "validate"]);
});

test("approved production execution reaches the adapter handoff but does not mutate infrastructure", () => {
  const intent = {
    tenantId: "tenant-a",
    projectId: "project-a",
    description: "Secure enterprise document translation service",
    environment: "production" as const,
    providers: ["aws" as const],
    domain: "translate.example.test",
    autonomy: "approval" as const,
  };

  const result = prepareExecution({
    controlPlanePlan: createBuildPlan(intent),
    builderPlan: createHoareBuilderPlan(intent),
    deploymentPlan: createDeploymentPlan(intent),
    approved: true,
  });

  assert.equal(result.status, "ready");
  assert.deepEqual(result.completedStages, ["plan", "validate", "approve"]);
  assert.equal(result.providerPlans.length, 1);
  assert.equal(result.providerPlans[0]?.provider, "aws");
});
