import assert from "node:assert/strict";
import test from "node:test";
import { deployWithGate, requireDeploymentEligibility } from "./deployment-gate";
import { CloudRunDeploymentAdapter } from "./cloud-run-adapter";

test("deployment is blocked without attestation", async () => {
  const eligibility = requireDeploymentEligibility({
    simulationAllowed: true,
    attested: false,
    provenanceVerified: false,
  });

  assert.equal(eligibility.allowed, false);
  assert.equal(eligibility.reason, "ATTESTATION_REQUIRED");
});

test("deployment is blocked when simulation is denied", async () => {
  const eligibility = requireDeploymentEligibility({
    simulationAllowed: false,
    attested: true,
    provenanceVerified: true,
  });

  assert.equal(eligibility.allowed, false);
  assert.equal(eligibility.reason, "SIMULATION_DENIED");
});

test("Cloud Run adapter requires a 64-character artifact hash", async () => {
  const adapter = new CloudRunDeploymentAdapter({
    async deploy() {
      throw new Error("should not execute");
    },
  });

  await assert.rejects(
    () => adapter.deploy({
      unitId: "unit-1",
      commandId: "cloud.deploy",
      artifactPath: "dist/app",
      artifactSha256: "bad",
      provenanceHash: "a".repeat(64),
      target: "cloud-run",
      serviceName: "hoare-test",
    }),
    /ARTIFACT_HASH_REQUIRED/,
  );
});
