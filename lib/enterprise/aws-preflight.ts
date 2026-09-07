import type { AwsIamDryRunPlan } from "./aws-iam-dry-run";

export type AwsPreflight = Readonly<{
  authenticated: boolean;
  accountId: string;
  region: string;
  allowedRegions: string[];
  tenantId: string;
  iamPlan: AwsIamDryRunPlan;
  ready: boolean;
  reasons: string[];
}>;

export function runAwsPreflight(input: Omit<AwsPreflight, "ready" | "reasons">): AwsPreflight {
  const reasons: string[] = [];
  if (!input.authenticated) reasons.push("aws-authentication-required");
  if (!/^\d{12}$/.test(input.accountId)) reasons.push("aws-account-id-invalid");
  if (!input.allowedRegions.includes(input.region)) reasons.push("aws-region-not-allowed");
  if (!input.tenantId) reasons.push("aws-tenant-required");
  if (!input.iamPlan.compliant) reasons.push(...input.iamPlan.reasons);
  return { ...input, ready: reasons.length === 0, reasons };
}
