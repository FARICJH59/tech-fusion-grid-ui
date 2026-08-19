import { IAMClient } from "@aws-sdk/client-iam";
import type { AwsApprovedExecutionPlan } from "./aws-approved-execution";
import { executeApprovedAwsRole, rollbackApprovedAwsRole } from "./aws-role-execution-adapter";

export interface AwsLiveIntegrationConfig {
  enabled: boolean;
  region: string;
  roleArn: string;
  tenantId: string;
}

export function loadAwsLiveIntegrationConfig(env: NodeJS.ProcessEnv = process.env): AwsLiveIntegrationConfig {
  return {
    enabled: env.HOARE_AWS_LIVE_TEST === "true",
    region: env.AWS_REGION ?? "",
    roleArn: env.HOARE_AWS_EXECUTION_ROLE_ARN ?? "",
    tenantId: env.HOARE_TEST_TENANT ?? "",
  };
}

export function assertAwsLiveIntegrationEnabled(config: AwsLiveIntegrationConfig, plan: AwsApprovedExecutionPlan): void {
  if (!config.enabled) throw new Error("AWS live integration is disabled; set HOARE_AWS_LIVE_TEST=true explicitly");
  if (!config.region) throw new Error("AWS_REGION is required");
  if (!config.roleArn) throw new Error("HOARE_AWS_EXECUTION_ROLE_ARN is required");
  if (!config.tenantId) throw new Error("HOARE_TEST_TENANT is required");
  if (config.tenantId !== plan.request.tenantId) throw new Error("Live test tenant does not match approved plan");
}

export async function runAwsLiveRoleIntegration(
  plan: AwsApprovedExecutionPlan,
  trustPolicyDocument: string,
  config = loadAwsLiveIntegrationConfig(),
): Promise<{ roleArn: string; rolledBack: boolean }> {
  assertAwsLiveIntegrationEnabled(config, plan);
  const iam = new IAMClient({ region: config.region });
  let roleArn = "";

  try {
    const result = await executeApprovedAwsRole(plan, {
      createRole: async (input) => {
        const { CreateRoleCommand } = await import("@aws-sdk/client-iam");
        const response = await iam.send(new CreateRoleCommand(input));
        if (!response.Role?.Arn) throw new Error("AWS CreateRole returned no role ARN");
        return { Arn: response.Role.Arn };
      },
      deleteRole: async (input) => {
        const { DeleteRoleCommand } = await import("@aws-sdk/client-iam");
        await iam.send(new DeleteRoleCommand(input));
      },
    }, trustPolicyDocument);
    roleArn = result.roleArn;

    const { GetRoleCommand } = await import("@aws-sdk/client-iam");
    const verified = await iam.send(new GetRoleCommand({ RoleName: plan.request.roleName }));
    if (verified.Role?.Arn !== roleArn || !verified.Role.AssumeRolePolicyDocument) {
      throw new Error("AWS role verification failed");
    }

    return { roleArn, rolledBack: false };
  } catch (error) {
    if (roleArn) {
      await rollbackApprovedAwsRole(plan, {
        createRole: async () => ({ Arn: roleArn }),
        deleteRole: async (input) => {
          const { DeleteRoleCommand } = await import("@aws-sdk/client-iam");
          await iam.send(new DeleteRoleCommand(input));
        },
      });
    }
    throw error;
  }
}
