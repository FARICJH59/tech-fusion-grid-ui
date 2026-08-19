import type { HoareChangeProposal } from "./approval-artifact";
import { isApprovedChangeProposal } from "./approval-artifact";
import type { AwsPolicyValidationResult } from "./aws-policy-validator";
import { isAwsPolicyApproved } from "./aws-policy-validator";

export interface AwsRoleExecutionRequest {
  action: "iam.create-role";
  tenantId: string;
  roleName: string;
  trustPolicyHash: string;
  permissionsBoundaryArn: string;
}

export interface AwsApprovedExecutionPlan {
  provider: "aws";
  mode: "approved-single-operation";
  request: AwsRoleExecutionRequest;
  rollback: { required: true; action: "iam.delete-role" };
  mutationAllowed: true;
}

export function prepareApprovedAwsRoleExecution(
  proposal: HoareChangeProposal,
  policy: AwsPolicyValidationResult,
  request: AwsRoleExecutionRequest,
): AwsApprovedExecutionPlan {
  if (!isApprovedChangeProposal(proposal)) throw new Error("Approved proposal required");
  if (!isAwsPolicyApproved(policy)) throw new Error("AWS IAM policy must pass validation");
  if (request.action !== "iam.create-role") throw new Error("Only the constrained role operation is allowed");
  if (!request.tenantId || request.tenantId !== proposal.tenantId) throw new Error("Tenant mismatch");
  if (!/^hoare-tenant-agent-[a-zA-Z0-9-]+$/.test(request.roleName)) throw new Error("Invalid tenant role name");
  if (!request.trustPolicyHash || !request.permissionsBoundaryArn) throw new Error("Trust policy hash and permissions boundary are required");

  return {
    provider: "aws",
    mode: "approved-single-operation",
    request,
    rollback: { required: true, action: "iam.delete-role" },
    mutationAllowed: true,
  };
}
