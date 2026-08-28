import type { AwsIamDryRunPlan } from "./aws-iam-dry-run";
import type { AwsPreflightResult } from "./aws-preflight";
import type { AwsPolicyValidationResult } from "./aws-policy-validator";
import type { AwsReadinessGateResult } from "./aws-readiness-gate";

export interface HoareChangeProposal {
  schema: "hoare.change-proposal/v1";
  projectId: string;
  tenantId: string;
  provider: "aws";
  region: string;
  architecture: string;
  modelStrategy: string;
  iam: AwsIamDryRunPlan;
  preflight: AwsPreflightResult;
  policyValidation: AwsPolicyValidationResult;
  readiness: AwsReadinessGateResult;
  rollback: { required: true; strategy: string };
  approval: { status: "pending" | "approved" | "rejected"; approvedBy?: string; approvedAt?: string };
}

export function createChangeProposal(input: Omit<HoareChangeProposal, "schema" | "approval">): HoareChangeProposal {
  return {
    schema: "hoare.change-proposal/v1",
    ...input,
    approval: { status: "pending" },
  };
}

export function approveChangeProposal(
  proposal: HoareChangeProposal,
  approvedBy: string,
  approvedAt: string,
): HoareChangeProposal {
  if (proposal.readiness.decision !== "ready-for-approval") {
    throw new Error("Change proposal is not eligible for approval");
  }
  if (!approvedBy.trim()) throw new Error("Approver identity is required");

  return {
    ...proposal,
    approval: { status: "approved", approvedBy, approvedAt },
  };
}

export function isApprovedChangeProposal(proposal: HoareChangeProposal): boolean {
  return (
    proposal.approval.status === "approved" &&
    Boolean(proposal.approval.approvedBy) &&
    Boolean(proposal.approval.approvedAt) &&
    proposal.readiness.decision === "ready-for-approval" &&
    proposal.readiness.mutationAllowed === false
  );
}
