import assert from "node:assert/strict";
import test from "node:test";
import { verifyDeployment } from "./deployment-verifier";

const hash = "a".repeat(64);

test("verifies healthy deployment with matching revision", () => {
  const result = verifyDeployment({
    unitId: "unit-1",
    deploymentId: "deploy-1",
    artifactSha256: hash,
    provenanceHash: hash,
    expectedRevision: "rev-1",
    observedRevision: "rev-1",
    healthy: true,
  });

  assert.equal(result.verified, true);
  assert.equal(result.reason, "DEPLOYMENT_VERIFIED");
  assert.match(result.verificationHash, /^[a-f0-9]{64}$/);
});

test("rejects unhealthy deployment", () => {
  const result = verifyDeployment({
    unitId: "unit-1",
    deploymentId: "deploy-1",
    artifactSha256: hash,
    provenanceHash: hash,
    observedRevision: "rev-1",
    healthy: false,
  });

  assert.equal(result.verified, false);
  assert.equal(result.reason, "HEALTH_CHECK_FAILED");
});

test("rejects revision mismatch", () => {
  const result = verifyDeployment({
    unitId: "unit-1",
    deploymentId: "deploy-1",
    artifactSha256: hash,
    provenanceHash: hash,
    expectedRevision: "rev-expected",
    observedRevision: "rev-observed",
    healthy: true,
  });

  assert.equal(result.verified, false);
  assert.equal(result.reason, "REVISION_MISMATCH");
});
