import test from "node:test";
import assert from "node:assert/strict";
import type { BuilderCapabilityPlan } from "./capability-planner";
import { planResources, type ResourceTarget } from "./resource-planner";

const capabilityPlan = {
  plan: {} as BuilderCapabilityPlan["plan"],
  requirements: {
    security: {
      classification: "classified",
      allowedProviders: ["nvidia"],
      allowedRegions: ["secure-east"],
      egressAllowed: false,
    },
    compute: {
      accelerator: "gpu",
      acceleratorModel: "H200",
      minAccelerators: 2,
      minCpu: 32,
      minMemoryGiB: 256,
    },
    serviceLevel: {
      minAvailability: 0.999,
      maxLatencyMs: 500,
      minReplicas: 1,
      maxCostPerHour: 20,
    },
  },
  constraints: [],
} satisfies BuilderCapabilityPlan;

const targets: ResourceTarget[] = [
  {
    id: "secure-h200",
    provider: "nvidia",
    region: "secure-east",
    environment: "production",
    classification: "classified",
    egressAllowed: false,
    accelerator: "gpu",
    acceleratorModels: ["H200"],
    acceleratorCount: 8,
    cpu: 96,
    memoryGiB: 1024,
    availability: 0.9999,
    estimatedLatencyMs: 120,
    estimatedCostPerHour: 18,
  },
  {
    id: "public-h200",
    provider: "nvidia",
    region: "secure-east",
    environment: "production",
    classification: "classified",
    egressAllowed: true,
    accelerator: "gpu",
    acceleratorModels: ["H200"],
    acceleratorCount: 8,
    cpu: 96,
    memoryGiB: 1024,
    availability: 0.9999,
    estimatedLatencyMs: 80,
    estimatedCostPerHour: 12,
  },
];

test("resource planner selects eligible target and rejects classified egress", () => {
  const result = planResources(capabilityPlan, targets);
  assert.equal(result.status, "selected");
  assert.equal(result.selected?.id, "secure-h200");
  assert.equal(result.candidates.find((candidate) => candidate.target.id === "public-h200")?.eligible, false);
  assert.match(result.candidates.find((candidate) => candidate.target.id === "public-h200")?.reasons.join(",") ?? "", /classified_target_allows_egress/);
});
