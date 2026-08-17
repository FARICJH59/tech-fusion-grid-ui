import assert from "node:assert/strict";
import test from "node:test";
import { deployGoverned } from "./governed-deployer";
import { DeploymentAdapterRegistry } from "./deployment-registry";

test("governed deployment resolves the selected provider adapter", async () => {
  const registry = new DeploymentAdapterRegistry();
  registry.register({
    target: "cloud-run",
    async deploy(request) {
      return {
        unitId: request.unitId,
        target: "cloud-run",
        accepted: true,
        deploymentId: "test-deployment",
        message: "cloud-run adapter invoked",
      };
    },
  });

  const result = await deployGoverned(
    registry,
    {
      unitId: "unit-1",
      commandId: "cloud.deploy",
      artifactPath: "dist/app",
      artifactSha256: "a".repeat(64),
      provenanceHash: "b".repeat(64),
      target: "cloud-run",
      serviceName: "hoare-test",
    },
    {
      allowed: true,
      reason: "DEPLOYMENT_ELIGIBLE",
    },
  );

  assert.equal(result.accepted, true);
  assert.equal(result.target, "cloud-run");
  assert.equal(result.deploymentId, "test-deployment");
});

test("governed deployment remains blocked by the gate", async () => {
  const registry = new DeploymentAdapterRegistry();
  let invoked = false;
  registry.register({
    target: "cloud-run",
    async deploy(request) {
      invoked = true;
      return {
        unitId: request.unitId,
        target: "cloud-run",
        accepted: true,
        message: "must not execute",
      };
    },
  });

  const result = await deployGoverned(
    registry,
    {
      unitId: "unit-2",
      commandId: "cloud.deploy",
      artifactPath: "dist/app",
      artifactSha256: "a".repeat(64),
      provenanceHash: "b".repeat(64),
      target: "cloud-run",
      serviceName: "hoare-test",
    },
    {
      allowed: false,
      reason: "PROVENANCE_UNVERIFIED",
    },
  );

  assert.equal(result.accepted, false);
  assert.equal(result.message, "PROVENANCE_UNVERIFIED");
  assert.equal(invoked, false);
});
