import type { ExecutionUnit } from "./execution-unit";

export interface SimulationBudget {
  energy_available: number;
  quota_available: number;
}

export interface SimulationResult {
  allowed: boolean;
  reason: string;
  total_energy_cost: number;
  total_quota_cost: number;
  unit_results: Array<{
    unit_id: string;
    allowed: boolean;
    reason: string;
  }>;
}

export function simulateUnits(
  units: ExecutionUnit[],
  budget: SimulationBudget,
): SimulationResult {
  const totalEnergy = units.reduce((sum, unit) => sum + unit.energy_cost, 0);
  const totalQuota = units.reduce((sum, unit) => sum + unit.quota_cost, 0);
  const energyOk = totalEnergy <= budget.energy_available;
  const quotaOk = totalQuota <= budget.quota_available;

  return {
    allowed: energyOk && quotaOk,
    reason: !energyOk
      ? "ENERGY_QUOTA_BUDGET_EXCEEDED"
      : !quotaOk
        ? "QUOTA_BUDGET_EXCEEDED"
        : "SIMULATION_ALLOWED",
    total_energy_cost: totalEnergy,
    total_quota_cost: totalQuota,
    unit_results: units.map((unit) => ({
      unit_id: unit.unit_id,
      allowed: energyOk && quotaOk,
      reason: energyOk && quotaOk ? "ALLOWED" : "BUDGET_DENIED",
    })),
  };
}
