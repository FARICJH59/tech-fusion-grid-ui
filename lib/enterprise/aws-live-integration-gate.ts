import type { AwsApprovedExecutionPlan } from "./aws-approved-execution";

export type AwsLiveIntegrationConfig = Readonly<{
  enabled: boolean;
  region?: string;
  executionRoleArn?: string;
  tenantId?: string;
}>;

export function loadAwsLiveIntegrationConfig(env: Record<string, string | undefined> = process.env): AwsLiveIntegrationConfig {
  return {
    enabled: env.HOARE_AWS_LIVE_TEST === "true",
    region: env.AWS_REGION,
    executionRoleArn: env.HOARE_AWS_EXECUTION_ROLE_ARN,
    tenantId: env.HOARE_TEST_TENANT,
  };
}

export function assertAwsLiveIntegrationEnabled(config: AwsLiveIntegrationConfig, plan: AwsApprovedExecutionPlan): void {
  if (!config.enabled) throw new Error("AWS live integration disabled; set HOARE_AWS_LIVE_TEST=true");
  if (!config.region || !config.executionRoleArn || !config.tenantId) throw new Error("AWS live integration environment incomplete");
  if (config.region !== plan.request.permissionsBoundaryArn.split(":")[3] && config.region !== "us-east-1") {
    throw new Error("AWS live integration region mismatch");
  }
  if (config.tenantId !== plan.request.tenantId) throw new Error("AWS live integration tenant mismatch");
}
