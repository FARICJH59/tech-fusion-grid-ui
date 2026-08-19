import assert from "node:assert/strict";
import test from "node:test";

import { verifyExecution, canCloseDeployment } from "../lib/enterprise/evidence-verifier";

test("HOARE closes a deployment only after all security and evidence checks pass", () => {
  const evidence = verifyExecution(
    {
      status: "ready",
      completedStages: ["plan", "validate", "approve"],
      providerPlans: [],
      reasons: [],
    },
    [
      { check: "identity-policy", status: "pass", detail: "policy verified" },
      { check: "tenant-isolation", status: "pass", detail: "tenant boundary verified" },
      { check: "https-tls", status: "pass", detail: "TLS verified" },
      { check: "health", status: "pass", detail: "service healthy" },
      { check: "audit-evidence", status: "pass", detail: "evidence captured" },
    ],
  );

  assert.equal(evidence.verified, true);
  assert.equal(evidence.immutableRecordRequired, true);
  assert.equal(canCloseDeployment(evidence), true);
});

test("a failed verification prevents deployment closure", () => {
  const evidence = verifyExecution(
    {
      status: "ready",
      completedStages: ["plan", "validate", "approve"],
      providerPlans: [],
      reasons: [],
    },
    [
      { check: "identity-policy", status: "pass", detail: "policy verified" },
      { check: "tenant-isolation", status: "fail", detail: "boundary not verified" },
      { check: "https-tls", status: "pass", detail: "TLS verified" },
      { check: "health", status: "pass", detail: "service healthy" },
      { check: "audit-evidence", status: "pass", detail: "evidence captured" },
    ],
  );

  assert.equal(evidence.verified, false);
  assert.equal(canCloseDeployment(evidence), false);
});
