import type { AwsApprovedExecutionPlan } from "./aws-approved-execution";

export interface AwsRoleApi {
  createRole(input: { RoleName: string; AssumeRolePolicyDocument: string; PermissionsBoundary: string }): Promise<{ Arn: string }>;
  deleteRole(input: { RoleName: string }): Promise<void>;
}

export interface AwsRoleExecutionResult {
  provider: "aws";
  operation: "iam.create-role";
  status: "executed";
  roleArn: string;
  rollbackAvailable: true;
}

/**
 * Thin provider adapter. Credential acquisition stays outside this module;
 * the caller supplies an AWS SDK-compatible API client backed by short-lived
 * credentials (for example, federation/role assumption).
 */
export async function executeApprovedAwsRole(
  plan: AwsApprovedExecutionPlan,
  api: AwsRoleApi,
  trustPolicyDocument: string,
): Promise<AwsRoleExecutionResult> {
  if (!plan.mutationAllowed || plan.mode !== "approved-single-operation") {
    throw new Error("Approved single-operation plan required");
  }
  if (!trustPolicyDocument.trim()) throw new Error("Trust policy document is required");

  const created = await api.createRole({
    RoleName: plan.request.roleName,
    AssumeRolePolicyDocument: trustPolicyDocument,
    PermissionsBoundary: plan.request.permissionsBoundaryArn,
  });

  return {
    provider: "aws",
    operation: "iam.create-role",
    status: "executed",
    roleArn: created.Arn,
    rollbackAvailable: true,
  };
}

export async function rollbackApprovedAwsRole(plan: AwsApprovedExecutionPlan, api: AwsRoleApi): Promise<void> {
  if (plan.rollback.action !== "iam.delete-role") throw new Error("Unsupported rollback action");
  await api.deleteRole({ RoleName: plan.request.roleName });
}
