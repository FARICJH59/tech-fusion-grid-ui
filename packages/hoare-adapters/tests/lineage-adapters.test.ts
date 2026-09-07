import test from "node:test";
import assert from "node:assert/strict";

import {
  toIntelligenceCapability,
  toProofObligation,
  toVerificationResult,
} from "../src/index";


test("hoare-ai adapter preserves capability identity and marks provenance", () => {
  const capability = toIntelligenceCapability({
    id: "planner.v1",
    name: "Planner",
    description: "Builds execution plans",
    category: "planning",
    version: "1.2.0",
    metadata: { source: "registry" },
  });

  assert.deepEqual(capability, {
    id: "planner.v1",
    name: "Planner",
    description: "Builds execution plans",
    category: "planning",
    version: "1.2.0",
    provenance: "hoare-ai",
    metadata: { source: "registry" },
  });
});


test("HOARE-AGENT adapter preserves a formal proof obligation", () => {
  const obligation = toProofObligation({
    proofId: "proof-1",
    precondition: "x >= 0",
    program: "x := x + 1",
    postcondition: "x >= 1",
    stateDigest: "state-sha",
    verifier: "z3",
    verifierVersion: "4.13",
  });

  assert.equal(obligation.proofId, "proof-1");
  assert.equal(obligation.precondition, "x >= 0");
  assert.equal(obligation.program, "x := x + 1");
  assert.equal(obligation.postcondition, "x >= 1");
  assert.equal(obligation.verifier, "z3");
});


test("HOARE-AGENT adapter maps failed verification without granting execution", () => {
  const result = toVerificationResult({
    proofId: "proof-2",
    verified: false,
    verifier: "z3",
    proofDigest: "proof-sha",
    reason: "postcondition is not proven",
    verifiedAt: "2026-09-04T17:30:00.000Z",
  });

  assert.equal(result.verified, false);
  assert.equal(result.reason, "postcondition is not proven");
  assert.equal(result.proofDigest, "proof-sha");
});
