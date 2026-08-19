import { CreateRoleCommand, DeleteRoleCommand, GetRoleCommand, IAMClient } from "@aws-sdk/client-iam";
import type { AwsApprovedExecutionPlan } from "./aws-approved-execution";

export interface AwsLiveRoleVerification {
  verified: boolean;
  roleArn: string;
  trustPolicyPresent: boolean;
}

export async function executeLiveAwsRole(
  plan: AwsApprovedExecutionPlan,
  trustPolicyDocument: string,
  client: IAMClient = new IAMClient({}),
): Promise<AwsLiveRoleVerification> {
  if (!plan.mutationAllowed || plan.mode !== "approved-single-operation") {
    throw new Error("Approved single-operation plan required");
  }
  if (!trustPolicyDocument.trim()) throw new Error("Trust policy document is required");

  const created = await client.send(new CreateRoleCommand({
    RoleName: plan.request.roleName,
    AssumeRolePolicyDocument: trustPolicyDocument,
    PermissionsBoundary: plan.request.permissionsBoundaryArn,
  }));

  try {
    const role = await client.send(new GetRoleCommand({ RoleName: plan.request.roleName }));
    const verified = Boolean(role.Role?.Arn) && Boolean(role.Role?.AssumeRolePolicyDocument);
    if (!verified) throw new Error("AWS role verification failed");

    return {
      verified: true,
      roleArn: role.Role!.Arn!,
      trustPolicyPresent: true,
    };
  } catch (error) {
    try {
      await client.send(new DeleteRoleCommand({ RoleName: plan.request.roleName }));
    } catch (rollbackError) {
      throw new Error(`AWS role verification failed and rollback failed: ${String(rollbackError)}`);
    }
    throw error;
  }
}
