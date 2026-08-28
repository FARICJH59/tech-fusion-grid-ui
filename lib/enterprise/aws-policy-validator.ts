import type { AwsIamDryRunPlan } from "./aws-iam-dry-run";

export interface AwsPolicyValidationResult {
  provider: "aws";
  status: "pass" | "fail";
  checks: Record<string, "pass" | "fail">;
  reasons: string[];
}

const forbiddenActions = new Set(["iam:*", "iam:PassRole", "sts:CreateAccessKey", "*"]);

export function validateAwsIamPolicy(plan: AwsIamDryRunPlan): AwsPolicyValidationResult {
  const actions = plan.statements.flatMap((statement) => statement.Action);
  const resources = plan.statements.flatMap((statement) => statement.Resource);
  const checks: Record<string, "pass" | "fail"> = {
    provider: plan.provider === "aws" ? "pass" : "fail",
    dryRun: plan.mode === "dry-run" && plan.mutationAllowed === false ? "pass" : "fail",
    credentialBoundary: plan.explicitDenials.includes("long-lived-credentials") ? "pass" : "fail",
    passRoleDenied: plan.explicitDenials.includes("iam:PassRole") ? "pass" : "fail",
    accessKeyCreationDenied: plan.explicitDenials.includes("sts:CreateAccessKey") ? "pass" : "fail",
    noForbiddenActions: actions.some((action) => forbiddenActions.has(action)) ? "fail" : "pass",
    scopedResources: resources.length > 0 && !resources.includes("*") ? "pass" : "fail",
    tenantRoleBoundary: plan.roleNamePattern === "hoare-tenant-agent-*" ? "pass" : "fail",
  };

  const reasons = Object.entries(checks)
    .filter(([, value]) => value === "fail")
    .map(([check]) => `policy:${check}`);

  return { provider: "aws", status: reasons.length ? "fail" : "pass", checks, reasons };
}

export function isAwsPolicyApproved(result: AwsPolicyValidationResult): boolean {
  return result.status === "pass" && Object.values(result.checks).every((value) => value === "pass");
}
