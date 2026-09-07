import type { ChangeProposal } from "./approval-artifact";
import type { AwsIamPolicyValidation } from "./aws-policy-validator";

export type AwsApprovedRoleRequest = Readonly<{
  action: "iam.create-role";
  tenantId: string;
  region: string;
  roleName: string;
  trustPolicyHash: string;
  permissionsBoundaryArn: string;
}>;

export type AwsApprovedExecutionPlan = Readonly<{
  provider: "aws";
  mode: "approved-single-operation";
  request: AwsApprovedRoleRequest;
  rollback: { required: true; action: "iam.delete-role" };
  mutationAllowed: true;
}>;

export function prepareApprovedAwsRoleExecution(proposal: ChangeProposal, policy: AwsIamPolicyValidation, request: AwsApprovedRoleRequest): AwsApprovedExecutionPlan {
  if (!proposal || proposal.provider !== "aws") throw new Error("aws_proposal_required");
  if (proposal.approval.status !== "approved") throw new Error("aws_change_proposal_not_approved");
  if (proposal.tenantId !== request.tenantId) throw new Error("aws_execution_tenant_mismatch");
  if (!policy.valid) throw new Error("aws_policy_validation_failed");
  if (request.action !== "iam.create-role") throw new Error("aws_action_not_approved");
  if (!request.region || !request.roleName || !request.trustPolicyHash || !request.permissionsBoundaryArn) throw new Error("aws_role_request_incomplete");
  return { provider: "aws", mode: "approved-single-operation", request, rollback: { required: true, action: "iam.delete-role" }, mutationAllowed: true };
}
