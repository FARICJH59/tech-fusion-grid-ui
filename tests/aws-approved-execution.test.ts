import assert from "node:assert/strict";
import test from "node:test";

import { compileAwsIamDryRun } from "../lib/enterprise/aws-iam-dry-run";
import { runAwsPreflight } from "../lib/enterprise/aws-preflight";
import { validateAwsIamPolicy } from "../lib/enterprise/aws-policy-validator";
import { evaluateAwsReadiness } from "../lib/enterprise/aws-readiness-gate";
import { verifyExecution } from "../lib/enterprise/evidence-verifier";
import { createAwsDryRunEvidence } from "../lib/enterprise/dry-run-evidence";
import { approveChangeProposal, createChangeProposal } from "../lib/enterprise/approval-artifact";
import { prepareApprovedAwsRoleExecution } from "../lib/enterprise/aws-approved-execution";

function approvedProposal() {
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
  const pending = createChangeProposal({ projectId: "project-a", tenantId: "tenant-a", provider: "aws", region: "us-east-1", architecture: "tenant-isolated API", modelStrategy: "provider-neutral", iam, preflight, policyValidation: policy, readiness, rollback: { required: true, strategy: "delete the created role" } });
  return { proposal: approveChangeProposal(pending, "operator@example.com", "2026-08-19T16:00:00Z"), policy };
}

test("approved proposal permits only the constrained AWS role operation", () => {
  const { proposal, policy } = approvedProposal();
  const plan = prepareApprovedAwsRoleExecution(proposal, policy, {
    action: "iam.create-role",
    tenantId: "tenant-a",
    roleName: "hoare-tenant-agent-tenant-a",
    trustPolicyHash: "sha256:example",
    permissionsBoundaryArn: "arn:aws:iam::123456789012:policy/HOARETenantBoundary",
  });

  assert.equal(plan.mode, "approved-single-operation");
  assert.equal(plan.mutationAllowed, true);
  assert.equal(plan.rollback.action, "iam.delete-role");
});

test("role execution blocks tenant mismatch", () => {
  const { proposal, policy } = approvedProposal();
  assert.throws(() => prepareApprovedAwsRoleExecution(proposal, policy, {
    action: "iam.create-role",
    tenantId: "tenant-b",
    roleName: "hoare-tenant-agent-tenant-b",
    trustPolicyHash: "sha256:example",
    permissionsBoundaryArn: "arn:aws:iam::123456789012:policy/HOARETenantBoundary",
  }));
});
