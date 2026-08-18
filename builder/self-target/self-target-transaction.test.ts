import assert from "node:assert/strict";
import test from "node:test";
import { createSelfTargetTransaction, evaluateSelfTargetTransaction } from "./self-target-transaction";

const passing = {
  ciPassed: true,
  simulationAllowed: true,
  attestationVerified: true,
  provenanceVerified: true,
  deploymentVerified: true,
  governanceAllowed: true,
};

test("creates deterministic HOARE self-target transaction", () => {
  const a = createSelfTargetTransaction({
    mode: "dry-run",
    intent: "Improve HOARE UI",
    candidateRevision: "candidate-1",
    releaseGate: passing,
  });
  const b = createSelfTargetTransaction({
    mode: "dry-run",
    intent: "Improve HOARE UI",
    candidateRevision: "candidate-1",
    releaseGate: passing,
  });

  assert.equal(a.transactionId, b.transactionId);
  assert.equal(a.target, "hoare");
});

test("dry-run cannot bypass release governance", () => {
  const transaction = createSelfTargetTransaction({
    mode: "dry-run",
    intent: "Improve HOARE UI",
    candidateRevision: "candidate-1",
    releaseGate: { ...passing, governanceAllowed: false },
  });

  const decision = evaluateSelfTargetTransaction(transaction);
  assert.equal(decision.allowed, false);
  assert.equal(decision.reason, "GOVERNANCE_DENIED");
});

test("passing dry-run is only release-eligible, not an execution", () => {
  const transaction = createSelfTargetTransaction({
    mode: "dry-run",
    intent: "Improve HOARE UI",
    candidateRevision: "candidate-1",
    releaseGate: passing,
  });

  const decision = evaluateSelfTargetTransaction(transaction);
  assert.equal(decision.allowed, true);
  assert.equal(decision.reason, "DRY_RUN_RELEASE_ELIGIBLE");
  assert.equal(transaction.mode, "dry-run");
});
