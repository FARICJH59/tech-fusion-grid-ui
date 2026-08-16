import { evaluateResourceEconomics, type ResourceEconomicsDecision } from "./resource-economics";

export type GovernedExecutionUnit = {
  unit_id: string;
  command_id: string;
  energy_cost: number;
  quota_cost: number;
  optional?: boolean;
};

export type PasorGovernanceContext = {
  tenantId: string;
  projectId: string;
  principalId: string;
  energyBudget?: number;
  quotaBudget?: number;
  carbonBudget?: number;
  carbonIntensity: number;
  rbacAllowed: boolean;
  policyAllowed: boolean;
};

export type PasorGovernanceResult = {
  allowed: boolean;
  disposition: "EXECUTE" | "DEFER" | "DENY";
  reason: string;
  economics: ResourceEconomicsDecision;
  governedBy: "PASOR";
};

/**
 * The knowledge/control boundary: planning intelligence may propose work,
 * but it cannot authorize execution. PASOR governance is the enforcement
 * boundary that converts a plan into an executable or deferred decision.
 */
export function governExecutionUnit(
  unit: GovernedExecutionUnit,
  context: PasorGovernanceContext,
): PasorGovernanceResult {
  if (!context.tenantId || !context.projectId || !context.principalId) {
    return {
      allowed: false,
      disposition: "DENY",
      reason: "IDENTITY_CONTEXT_REQUIRED",
      economics: { allowed: false, reason: "ALLOW", priorityMultiplier: 0, deferred: false },
      governedBy: "PASOR",
    };
  }

  if (!context.rbacAllowed) {
    return {
      allowed: false,
      disposition: "DENY",
      reason: "RBAC_DENIED",
      economics: { allowed: false, reason: "ALLOW", priorityMultiplier: 0, deferred: false },
      governedBy: "PASOR",
    };
  }

  if (!context.policyAllowed) {
    return {
      allowed: false,
      disposition: "DENY",
      reason: "POLICY_DENIED",
      economics: { allowed: false, reason: "ALLOW", priorityMultiplier: 0, deferred: false },
      governedBy: "PASOR",
    };
  }

  const economics = evaluateResourceEconomics({
    energyCost: unit.energy_cost,
    quotaCost: unit.quota_cost,
    carbonIntensity: context.carbonIntensity,
    energyBudget: context.energyBudget,
    quotaBudget: context.quotaBudget,
    carbonBudget: context.carbonBudget,
  });

  if (!economics.allowed) {
    return {
      allowed: false,
      disposition: unit.optional ? "DEFER" : "DENY",
      reason: economics.reason,
      economics,
      governedBy: "PASOR",
    };
  }

  return {
    allowed: true,
    disposition: "EXECUTE",
    reason: "GOVERNED_EXECUTION_ALLOWED",
    economics,
    governedBy: "PASOR",
  };
}
