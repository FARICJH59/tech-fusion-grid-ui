import test from "node:test";
import assert from "node:assert/strict";
import { evaluateSecurityPolicy, type CompiledSecurityPolicy } from "./security-policy";

const policy: CompiledSecurityPolicy = {
  version: "1",
  policyId: "policy-classified-h200",
  source: "aegisc",
  classification: "classified",
  allowedProviders: ["nvidia"],
  allowedRegions: ["secure-east"],
  egressAllowed: false,
  approvedAccelerators: ["H200"],
  identityRequired: true,
  auditRequired: true,
  digest: "sha256:test",
};

test("AEGISC policy permits matching Builder requirements", () => {
  const result = evaluateSecurityPolicy(policy, {
    security: {
      classification: "classified",
      allowedProviders: ["nvidia"],
      allowedRegions: ["secure-east"],
      egressAllowed: false,
    },
    compute: { accelerator: "gpu", acceleratorModel: "H200" },
  });
  assert.equal(result.allowed, true);
  assert.deepEqual(result.reasons, []);
});

test("AEGISC policy rejects requirements outside the approved boundary", () => {
  const result = evaluateSecurityPolicy(policy, {
    security: {
      classification: "classified",
      allowedProviders: ["gcp"],
      allowedRegions: ["public-west"],
      egressAllowed: true,
    },
    compute: { accelerator: "gpu", acceleratorModel: "A100" },
  });
  assert.equal(result.allowed, false);
  assert.ok(result.reasons.includes("provider_outside_aegisc_policy"));
  assert.ok(result.reasons.includes("region_outside_aegisc_policy"));
  assert.ok(result.reasons.includes("egress_policy_mismatch"));
  assert.ok(result.reasons.includes("accelerator_not_approved"));
});
