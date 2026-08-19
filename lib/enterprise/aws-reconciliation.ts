export interface DesiredAwsRoleState {
  roleName: string;
  roleArn: string;
  trustPolicyHash: string;
  permissionsBoundaryArn: string;
}

export interface ObservedAwsRoleState {
  roleName: string;
  roleArn: string;
  trustPolicyHash: string;
  permissionsBoundaryArn: string | null;
}

export interface AwsReconciliationResult {
  status: "compliant" | "drift";
  differences: string[];
  remediationRequired: boolean;
}

export function reconcileAwsRole(desired: DesiredAwsRoleState, observed: ObservedAwsRoleState): AwsReconciliationResult {
  const differences: string[] = [];
  if (desired.roleName !== observed.roleName) differences.push("roleName");
  if (desired.roleArn !== observed.roleArn) differences.push("roleArn");
  if (desired.trustPolicyHash !== observed.trustPolicyHash) differences.push("trustPolicy");
  if (desired.permissionsBoundaryArn !== observed.permissionsBoundaryArn) differences.push("permissionsBoundary");

  return {
    status: differences.length ? "drift" : "compliant",
    differences,
    remediationRequired: differences.length > 0,
  };
}
