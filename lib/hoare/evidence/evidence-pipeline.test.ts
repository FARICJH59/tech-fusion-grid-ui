import test from "node:test";
import assert from "node:assert/strict";
import { finalizeEvidencePipeline } from "./evidence-pipeline";

test("evidence pipeline reaches commit only after verification and reconciliation", () => {
  const result = finalizeEvidencePipeline(
    {
      transactionId: "tx-1",
      attemptId: "attempt-1",
      receipt: { status: "admitted" },
      result: { status: "success" },
      attestation: { verified: true },
      intendedStateDigest: "state-a",
      observedStateDigest: "state-a",
    },
    "state-a",
    "reconciliation-a",
  );
  assert.equal(result.evidenceVerified, true);
  assert.equal(result.reconciliationMatched, true);
  assert.equal(result.commit?.transactionId, "tx-1");
});

test("state drift blocks commit", () => {
  const result = finalizeEvidencePipeline(
    {
      transactionId: "tx-2",
      attemptId: "attempt-1",
      receipt: { status: "admitted" },
      result: { status: "success" },
      attestation: { verified: true },
      intendedStateDigest: "state-a",
      observedStateDigest: "state-b",
    },
    "state-a",
    "reconciliation-b",
  );
  assert.equal(result.evidenceVerified, true);
  assert.equal(result.reconciliationMatched, false);
  assert.equal(result.commit, null);
  assert.deepEqual(result.reasons, ["observed_state_digest_mismatch"]);
});
