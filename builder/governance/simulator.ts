import type { ExecutionPlan } from "../contracts/execution-plan";
import type { ExecutionUnit } from "../contracts/execution-unit";

export type GovernanceDecision = "ALLOW" | "DENY" | "REQUIRE_APPROVAL";

export interface GovernanceContext {
  energy_budget: number;
  quota_budget: number;
  carbon_budget?: number;
  role: string;
  allowed_actions: string[];
  tenant_active: boolean;
  capabilities?: string[];
}

export interface UnitSimulation {
  unit_id: string;
  decision: GovernanceDecision;
  reason: string;
  energy_cost: number;
  quota_cost: number;
  carbon_cost: number;
}

export interface GovernanceSimulation {
  execution_id: string;
  project_id: string;
  tenant_id: string;
  decision: GovernanceDecision;
  total_energy: number;
  total_quota: number;
  total_carbon: number;
  units: UnitSimulation[];
}

const ACTION_ROLES: Record<string, string[]> = {
  "ml.deploy_model": ["admin", "operator"],
  "ml.train_model": ["admin", "operator", "builder"],
};

function roleAllowed(commandId: string, role: string): boolean {
  const required = ACTION_ROLES[commandId];
  return !required || required.includes(role);
}

function unitCarbon(unit: ExecutionUnit): number {
  return Number((unit.energy_cost * 0.42).toFixed(3));
}

export function simulatePlan(
  plan: ExecutionPlan,
  context: GovernanceContext,
): GovernanceSimulation {
  const units = plan.execution_units;
  const seen = new Set<string>();
  const results: UnitSimulation[] = [];
  let totalEnergy = 0;
  let totalQuota = 0;
  let totalCarbon = 0;
  let decision: GovernanceDecision = context.tenant_active ? "ALLOW" : "DENY";

  if (!context.tenant_active) {
    return {
      execution_id: plan.execution_id,
      project_id: plan.project_id,
      tenant_id: plan.tenant_id,
      decision: "DENY",
      total_energy: 0,
      total_quota: 0,
      total_carbon: 0,
      units: units.map((unit) => ({
        unit_id: unit.unit_id,
        decision: "DENY",
        reason: "TENANT_INACTIVE",
        energy_cost: unit.energy_cost,
        quota_cost: unit.quota_cost,
        carbon_cost: unitCarbon(unit),
      })),
    };
  }

  for (const unit of units) {
    const carbon = unitCarbon(unit);
    let unitDecision: GovernanceDecision = "ALLOW";
    let reason = "GOVERNANCE_ALLOW";

    if (seen.has(unit.unit_id)) {
      unitDecision = "DENY";
      reason = "DUPLICATE_UNIT_ID";
    } else if (unit.dependencies.some((dependency) => !units.some((candidate) => candidate.unit_id === dependency))) {
      unitDecision = "DENY";
      reason = "UNKNOWN_DEPENDENCY";
    } else if (!context.allowed_actions.includes(unit.command_id)) {
      unitDecision = "DENY";
      reason = "ACTION_NOT_ALLOWED";
    } else if (!roleAllowed(unit.command_id, context.role)) {
      unitDecision = "DENY";
      reason = "RBAC_DENIED";
    } else if (unit.energy_cost < 0 || unit.quota_cost < 0) {
      unitDecision = "DENY";
      reason = "INVALID_RESOURCE_COST";
    } else if (context.capabilities && context.capabilities.length > 0 && !context.capabilities.includes(unit.command_id)) {
      unitDecision = "DENY";
      reason = "CAPABILITY_DENIED";
    } else if (totalEnergy + unit.energy_cost > context.energy_budget) {
      unitDecision = "DENY";
      reason = "ENERGY_BUDGET_EXCEEDED";
    } else if (totalQuota + unit.quota_cost > context.quota_budget) {
      unitDecision = "DENY";
      reason = "QUOTA_BUDGET_EXCEEDED";
    } else if (context.carbon_budget !== undefined && totalCarbon + carbon > context.carbon_budget) {
      unitDecision = "DENY";
      reason = "CARBON_BUDGET_EXCEEDED";
    }

    if (unitDecision === "ALLOW") {
      totalEnergy += unit.energy_cost;
      totalQuota += unit.quota_cost;
      totalCarbon += carbon;
      seen.add(unit.unit_id);
    } else if (!unit.optional) {
      decision = "DENY";
    }

    results.push({
      unit_id: unit.unit_id,
      decision: unitDecision,
      reason,
      energy_cost: unit.energy_cost,
      quota_cost: unit.quota_cost,
      carbon_cost: carbon,
    });
  }

  return {
    execution_id: plan.execution_id,
    project_id: plan.project_id,
    tenant_id: plan.tenant_id,
    decision,
    total_energy: totalEnergy,
    total_quota: totalQuota,
    total_carbon: totalCarbon,
    units: results,
  };
}
