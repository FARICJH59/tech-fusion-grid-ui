import assert from "node:assert/strict";
import test from "node:test";

import { compileAwsIamDryRun } from "../lib/enterprise/aws-iam-dry-run";
import { verifyExecution } from "../lib/enterprise/evidence-verifier";
import {
  createAwsDryRunEvidence,
  isAdmissibleDryRunEvidence,
} from "../lib/enterprise/dry-run-evidence";

test("AWS dry-run output becomes auditable HOARE evidence without mutation", () => {
  const iamPlan = compileAwsIamDryRun({
    provider: "aws",
    roleBoundary: "tenant-agent",
    credentialStrategy: "temporary",
    permissions: ["translation.invoke", "storage.read-scoped"],
    forbidden: ["iam.*", "admin.*", "long-lived-credentials"],
  });

  const observations = [
    { check: "identity-policy" as const, status: "pass" as const, detail: "dry-run policy validated" },
    { check: "tenant-isolation" as const, status: "pass" as const, detail: "tenant scope validated" },
    { check: "https-tls" as const, status: "pass" as const, detail: "deployment plan requires TLS" },
    { check: "health" as const, status: "pass" as const, detail: "preflight passed" },
    { check: "audit-evidence" as const, status: "pass" as const, detail: "dry-run recorded" },
  ];

  const evidence = verifyExecution(
    { status: "ready", completedStages: ["plan", "validate", "approve"], providerPlans: [], reasons: [] },
    observations,
  );

  const record = createAwsDryRunEvidence(iamPlan, observations, evidence);
  assert.equal(record.mutationExecuted, false);
  assert.equal(record.evidence.verified, true);
  assert.equal(isAdmissibleDryRunEvidence(record), true);
});
