import test from "node:test";
import assert from "node:assert/strict";
import type { BuilderCapabilityPlan } from "./capability-planner";
import { planResourcesWithSecurity } from "./secure-resource-planner";
import type { CompiledSecurityPolicy } from "./security-policy";
import type { ResourceTarget } from "./resource-planner";

const plan = {
  plan: {} as BuilderCapabilityPlan["plan"],
  requirements: {
    security: { classification: "classified", allowedProviders: ["nvidia"], allowedRegions: ["secure-east"], egressAllowed: false },
    compute: { accelerator: "gpu", acceleratorModel: "H200" },
  },
  constraints: [],
} satisfies BuilderCapabilityPlan;

const policy: CompiledSecurityPolicy = {
  version: "1", policyId: "p1", source: "aegisc", classification: "classified",
  allowedProviders: ["nvidia"], allowedRegions: ["secure-east"], egressAllowed: false,
  approvedAccelerators: ["H200"], identityRequired: true, auditRequired: true, digest: "sha256:test",
};

const target: ResourceTarget = {
  id: "h200", provider: "nvidia", region: "secure-east", environment: "production",
  classification: "classified", egressAllowed: false, accelerator: "gpu", acceleratorModels: ["H200"],
  acceleratorCount: 8, cpu: 96, memoryGiB: 1024, availability: 0.9999, estimatedLatencyMs: 100, estimatedCostPerHour: 10,
};

test("valid policy reaches resource selection", () => {
  const result = planResourcesWithSecurity(plan, [target], policy);
  assert.equal(result.security.allowed, true);
  assert.equal(result.selected?.id, "h200");
});

test("provider outside AEGISC policy is denied before placement", () => {
  const result = planResourcesWithSecurity(plan, [target], { ...policy, allowedProviders: ["gcp"] });
  assert.equal(result.security.allowed, false);
  assert.equal(result.selected, null);
  assert.equal(result.candidates.length, 0);
});

test("region outside AEGISC policy is denied before placement", () => {
  const result = planResourcesWithSecurity(plan, [target], { ...policy, allowedRegions: ["secure-west"] });
  assert.equal(result.security.allowed, false);
  assert.equal(result.selected, null);
});

test("egress mismatch is denied before placement", () => {
  const result = planResourcesWithSecurity(plan, [target], { ...policy, egressAllowed: true });
  assert.equal(result.security.allowed, false);
  assert.equal(result.selected, null);
});

test("unapproved accelerator is denied before placement", () => {
  const result = planResourcesWithSecurity(plan, [target], { ...policy, approvedAccelerators: ["A100"] });
  assert.equal(result.security.allowed, false);
  assert.equal(result.selected, null);
});
