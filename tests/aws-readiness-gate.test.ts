import assert from "node:assert/strict";
import test from "node:test";

import { compileAwsIamDryRun } from "../lib/enterprise/aws-iam-dry-run";
import { runAwsPreflight } from "../lib/enterprise/aws-preflight";
import { validateAwsIamPolicy } from "../lib/enterprise/aws-policy-validator";
import { verifyExecution } from "../lib/enterprise/evidence-verifier";
import { createAwsDryRunEvidence } from "../lib/enterprise/dry-run-evidence";
import { evaluateAwsReadiness, isReadyForApproval } from "../lib/enterprise/aws-readiness-gate";

function buildInputs() {
  const iamPlan = compileAwsIamDryRun({
    provider: "aws",
    roleBoundary: "tenant-agent",
    credentialStrategy: "temporary",
    permissions: ["model.invoke"],
    forbidden: ["iam.*", "admin.*", "long-lived-credentials"],
  });
  const preflight = runAwsPreflight({
    authenticated: true,
    accountId: "123456789012",
    region: "us-east-1",
    allowedRegions: ["us-east-1"],
    tenantId: "tenant-a",
    iamPlan,
  });
  const policy = validateAwsIamPolicy(iamPlan);
  const observations = [
    { check: "identity-policy" as const, status: "pass" as const, detail: "validated" },
    { check: "tenant-isolation" as const, status: "pass" as const, detail: "validated" },
    { check: "https-tls" as const, status: "pass" as const, detail: "validated" },
    { check: "health" as const, status: "pass" as const, detail: "validated" },
    { check: "audit-evidence" as const, status: "pass" as const, detail: "recorded" },
  ];
  const evidenceBundle = verifyExecution(
    { status: "ready", completedStages: ["plan", "validate", "approve"], providerPlans: [], reasons: [] },
    observations,
  );
  const evidence = createAwsDryRunEvidence(iamPlan, observations, evidenceBundle);
  return { iamPlan, preflight, policy, evidence };
}

test("HOARE reaches ready-for-approval only when every AWS gate passes", () => {
  const { iamPlan, preflight, policy, evidence } = buildInputs();
  const result = evaluateAwsReadiness(preflight, policy, iamPlan, evidence);

  assert.equal(result.decision, "ready-for-approval");
  assert.equal(result.mutationAllowed, false);
  assert.equal(isReadyForApproval(result), true);
});

test("HOARE blocks approval when AWS policy validation fails", () => {
  const { iamPlan, preflight, evidence } = buildInputs();
  iamPlan.statements[0]!.Action.push("iam:PassRole");
  const policy = validateAwsIamPolicy(iamPlan);
  const result = evaluateAwsReadiness(preflight, policy, iamPlan, evidence);

  assert.equal(result.decision, "blocked");
  assert.ok(result.reasons.includes("aws-readiness:policy"));
  assert.equal(result.mutationAllowed, false);
});
