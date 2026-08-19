import type { AwsIamDryRunPlan } from "./aws-iam-dry-run";

export interface AwsPreflightInput {
  authenticated: boolean;
  accountId: string | null;
  region: string | null;
  allowedRegions: string[];
  tenantId: string;
  iamPlan: AwsIamDryRunPlan;
}

export interface AwsPreflightResult {
  provider: "aws";
  status: "ready" | "blocked";
  checks: Record<string, "pass" | "fail">;
  reasons: string[];
  mutationAllowed: false;
}

export function runAwsPreflight(input: AwsPreflightInput): AwsPreflightResult {
  const checks: Record<string, "pass" | "fail"> = {
    authenticated: input.authenticated ? "pass" : "fail",
    account: input.accountId ? "pass" : "fail",
    region: input.region && input.allowedRegions.includes(input.region) ? "pass" : "fail",
    tenant: input.tenantId.length > 0 ? "pass" : "fail",
    dryRun: input.iamPlan.mode === "dry-run" && !input.iamPlan.mutationAllowed ? "pass" : "fail",
    privilegeBoundary: input.iamPlan.explicitDenials.includes("iam:PassRole") ? "pass" : "fail",
  };

  const reasons = Object.entries(checks)
    .filter(([, status]) => status === "fail")
    .map(([check]) => `preflight:${check}`);

  return {
    provider: "aws",
    status: reasons.length ? "blocked" : "ready",
    checks,
    reasons,
    mutationAllowed: false,
  };
}

export function isAwsPreflightReady(result: AwsPreflightResult): boolean {
  return result.status === "ready" && result.mutationAllowed === false && Object.values(result.checks).every((v) => v === "pass");
}
