import type { AwsIamDryRunPlan } from "./aws-iam-dry-run";
import type { AwsPreflight } from "./aws-preflight";
import type { AwsIamPolicyValidation } from "./aws-policy-validator";
import type { AwsReadiness } from "./aws-readiness-gate";

export type ChangeProposal = {
  schema: "hoare.change-proposal/v1";
  projectId: string;
  tenantId: string;
  provider: "aws";
  region: string;
  architecture: string;
  modelStrategy: string;
  iam: AwsIamDryRunPlan;
  preflight: AwsPreflight;
  policyValidation: AwsIamPolicyValidation;
  readiness: AwsReadiness;
  rollback: { required: boolean; strategy: string };
  approval: { status: "pending" | "approved"; approvedBy?: string; approvedAt?: string };
};

export function createChangeProposal(input: Omit<ChangeProposal, "schema" | "approval">): ChangeProposal {
  return { schema: "hoare.change-proposal/v1", ...input, approval: { status: "pending" } };
}

export function approveChangeProposal(proposal: ChangeProposal, operator: string, approvedAt: string): ChangeProposal {
  if (proposal.readiness.decision !== "ready-for-approval") throw new Error("change_proposal_not_ready_for_approval");
  if (!operator) throw new Error("change_proposal_approver_required");
  return { ...proposal, approval: { status: "approved", approvedBy: operator, approvedAt } };
}

export function isApprovedChangeProposal(proposal: ChangeProposal): boolean {
  return proposal.schema === "hoare.change-proposal/v1" && proposal.approval.status === "approved" && proposal.readiness.decision === "ready-for-approval";
}
