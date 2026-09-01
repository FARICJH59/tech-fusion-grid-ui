import assert from "node:assert/strict";
import test from "node:test";
import { buildCapabilityPlan } from "../lib/hoare/builder/capability-planner";
import { planBuilderIntent } from "../lib/hoare/builder/planner";

test("builder capability planning normalizes security, compute and SLO constraints", () => {
  const plan = planBuilderIntent({
    tenantId: "tenant-1",
    name: "mission-ai",
    description: "Mission inference service",
    resources: ["tenant", "infrastructure", "application", "model"],
  }, "nvidia-dynamo", "staging");

  const capability = buildCapabilityPlan(plan, {
    security: {
      classification: "controlled",
      allowedProviders: ["nvidia-dynamo"],
      allowedRegions: ["us-east4"],
      egressAllowed: false,
    },
    compute: {
      accelerator: "gpu",
      acceleratorModel: "NVIDIA-H200",
      minAccelerators: 2,
      minMemoryGiB: 256,
    },
    serviceLevel: {
      minAvailability: 0.999,
      maxLatencyMs: 500,
      minReplicas: 2,
      maxCostPerHour: 20,
    },
  });

  assert.equal(capability.requirements.compute.acceleratorModel, "NVIDIA-H200");
  assert.equal(capability.requirements.serviceLevel.maxLatencyMs, 500);
  assert.ok(capability.constraints.includes("classification:controlled"));
  assert.ok(capability.constraints.includes("providers:nvidia-dynamo"));
  assert.ok(capability.constraints.includes("accelerator:gpu"));
});

test("classified builder plans cannot permit egress", () => {
  const plan = planBuilderIntent({
    tenantId: "tenant-1",
    name: "classified-ai",
    description: "Classified workload",
    resources: ["tenant", "infrastructure", "application"],
  });

  assert.throws(
    () => buildCapabilityPlan(plan, {
      security: { classification: "classified", egressAllowed: true },
    }),
    /CLASSIFIED_BUILDER_PLAN_CANNOT_ALLOW_EGRESS/,
  );
});

test("builder capability planner rejects invalid SLO and compute requirements", () => {
  const plan = planBuilderIntent({
    tenantId: "tenant-1",
    name: "invalid",
    description: "Invalid requirements",
    resources: ["tenant"],
  });

  assert.throws(
    () => buildCapabilityPlan(plan, { serviceLevel: { minAvailability: 1.5 } }),
    /INVALID_BUILDER_REQUIREMENT:minAvailability/,
  );
  assert.throws(
    () => buildCapabilityPlan(plan, { compute: { accelerator: "none", acceleratorModel: "H200" } }),
    /INVALID_BUILDER_REQUIREMENT:acceleratorModel/,
  );
});
