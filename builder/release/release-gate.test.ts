import assert from "node:assert/strict";
import test from "node:test";
import { evaluateReleaseGate } from "./release-gate";

const passing = {
  ciPassed: true,
  simulationAllowed: true,
  attestationVerified: true,
  provenanceVerified: true,
  deploymentVerified: true,
  governanceAllowed: true,
};

test("release gate accepts a fully verified build", () => {
  assert.deepEqual(evaluateReleaseGate(passing), {
    releasable: true,
    reason: "RELEASE_ELIGIBLE",
  });
});

for (const key of [
  "ciPassed",
  "simulationAllowed",
  "attestationVerified",
  "provenanceVerified",
  "deploymentVerified",
  "governanceAllowed",
] as const) {
  test(`release gate rejects ${key}`, () => {
    const result = evaluateReleaseGate({ ...passing, [key]: false });
    assert.equal(result.releasable, false);
  });
}
