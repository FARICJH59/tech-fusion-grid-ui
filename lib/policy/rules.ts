import type { CloudActionType, RiskLevel } from "@/lib/cloud/cloud-types";

export type PolicyRule = {
  id: string;
  version: number;
  action: CloudActionType;
  maxRiskLevel: RiskLevel;
  allowAutoApprove: boolean;
  budgetGuardEnabled: boolean;
  requireTenantIsolation: boolean;
};

export const DEFAULT_POLICY_RULES: PolicyRule[] = [
  {
    id: "deploy-default",
    version: 1,
    action: "deploy",
    maxRiskLevel: "high",
    allowAutoApprove: false,
    budgetGuardEnabled: true,
    requireTenantIsolation: true,
  },
  {
    id: "scale-default",
    version: 1,
    action: "scale",
    maxRiskLevel: "medium",
    allowAutoApprove: true,
    budgetGuardEnabled: true,
    requireTenantIsolation: true,
  },
  {
    id: "rollback-default",
    version: 1,
    action: "rollback",
    maxRiskLevel: "critical",
    allowAutoApprove: true,
    budgetGuardEnabled: false,
    requireTenantIsolation: true,
  },
  {
    id: "remediation-default",
    version: 1,
    action: "remediation",
    maxRiskLevel: "high",
    allowAutoApprove: false,
    budgetGuardEnabled: true,
    requireTenantIsolation: true,
  },
];
