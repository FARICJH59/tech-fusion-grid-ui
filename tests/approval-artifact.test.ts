import assert from "node:assert/strict";
import test from "node:test";

import { compileAwsIamDryRun } from "../lib/enterprise/aws-iam-dry-run";
import { runAwsPreflight } from "../lib/enterprise/aws-preflight";
import { validateAwsIamPolicy } from "../lib/enterprise/aws-policy-validator";
import { evaluateAwsReadiness } from "../lib/enterprise/aws-readiness-gate";
import { verifyExecution } from "../lib/enterprise/evidence-verifier";
import { createAwsDryRunEvidence } from "../lib/enterprise/dry-run-evidence";
import { approveChangeProposal, createChangeProposal, isApprovedChangeProposal } from "../lib/enterprise/approval-artifact";

function proposal() {
  const iam = compileAwsIamDryRun({ provider: "aws", roleBoundary: "tenant-agent", credentialStrategy: "temporary", permissions: ["model.invoke"], forbidden: ["iam.*", "admin.*", "long-lived-credentials"] });
  const preflight = runAwsPreflight({ authenticated: true, accountId: "123456789012", region: "us-east-1", allowedRegions: ["us-east-1"], tenantId: "tenant-a", iamPlan: iam });
  const policy = validateAwsIamPolicy(iam);
  const observations = [
    { check: "identity-policy" as const, status: "pass" as const, detail: "validated" },
    { check: "tenant-isolation" as const, status: "pass" as const, detail: "validated" },
    { check: "https-tls" as const, status: "pass" as const, detail: "validated" },
    { check: "health" as const, status: "pass" as const, detail: "validated" },
    { check: "audit-evidence" as const, status: "pass" as const, detail: "recorded" },
  ];
  const bundle = verifyExecution({ status: "ready", completedStages: ["plan", "validate", "approve"], providerPlans: [], reasons: [] }, observations);
  const evidence = createAwsDryRunEvidence(iam, observations, bundle);
  const readiness = evaluateAwsReadiness(preflight, policy, iam, evidence);
  return createChangeProposal({ projectId: "project-a", tenantId: "tenant-a", provider: "aws", region: "us-east-1", architecture: "tenant-isolated API", modelStrategy: "provider-neutral", iam, preflight, policyValidation: policy, readiness, rollback: { required: true, strategy: "revert approved resource changes" } });
}

test("HOARE creates a pending governed change proposal", () => {
  const p = proposal();
  assert.equal(p.approval.status, "pending");
  assert.equal(p.schema, "hoare.change-proposal/v1");
  assert.equal(p.readiness.decision, "ready-for-approval");
});

test("only an eligible proposal can be approved", () => {
  const p = approveChangeProposal(proposal(), "operator@example.com", "2026-08-19T16:00:00Z");
  assert.equal(p.approval.status, "approved");
  assert.equal(isApprovedChangeProposal(p), true);
});

test("blocked readiness cannot be approved", () => {
  const p = proposal();
  p.readiness = { ...p.readiness, decision: "blocked", reasons: ["aws-readiness:policy"] };
  assert.throws(() => approveChangeProposal(p, "operator@example.com", "2026-08-19T16:00:00Z"));
});
