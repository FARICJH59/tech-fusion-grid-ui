import type { AwsIamDryRunPlan } from "./aws-iam-dry-run";

export type AwsIamPolicyValidation = Readonly<{
  valid: boolean;
  reasons: string[];
}>;

export function validateAwsIamPolicy(plan: AwsIamDryRunPlan): AwsIamPolicyValidation {
  const reasons: string[] = [];
  if (plan.credentialStrategy !== "temporary") reasons.push("temporary-credentials-required");
  if (plan.permissions.some((permission) => plan.forbidden.some((rule) => rule.endsWith(".*") ? permission.startsWith(rule.slice(0, -2)) : permission === rule))) reasons.push("forbidden-permission-requested");
  if (!plan.roleBoundary) reasons.push("role-boundary-required");
  return { valid: reasons.length === 0, reasons };
}
