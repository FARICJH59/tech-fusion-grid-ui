export type AwsIamDryRunInput = Readonly<{
  provider: "aws";
  roleBoundary: string;
  credentialStrategy: "temporary";
  permissions: string[];
  forbidden: string[];
}>;

export type AwsIamDryRunPlan = AwsIamDryRunInput & Readonly<{
  mode: "dry-run";
  compliant: boolean;
  reasons: string[];
}>;

export function compileAwsIamDryRun(input: AwsIamDryRunInput): AwsIamDryRunPlan {
  const reasons: string[] = [];
  if (input.provider !== "aws") reasons.push("aws-provider-required");
  if (input.credentialStrategy !== "temporary") reasons.push("temporary-credentials-required");
  if (input.permissions.length === 0) reasons.push("iam-permission-set-empty");
  if (input.forbidden.length === 0) reasons.push("forbidden-permissions-required");
  return { ...input, mode: "dry-run", compliant: reasons.length === 0, reasons };
}
