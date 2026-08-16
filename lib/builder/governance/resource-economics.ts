export type ResourceEconomicsInput = {
  energyCost: number;
  quotaCost: number;
  carbonIntensity: number;
  carbonBudget?: number;
  energyBudget?: number;
  quotaBudget?: number;
};

export type ResourceEconomicsDecision = {
  allowed: boolean;
  reason: "ALLOW" | "ENERGY_BUDGET" | "QUOTA_BUDGET" | "CARBON_BUDGET";
  priorityMultiplier: number;
  deferred: boolean;
};

/**
 * Pre-execution economics policy. It does not mutate infrastructure or bill
 * customers; it provides a deterministic decision for the governance layer.
 * carbonIntensity is an application/provider supplied estimate, not a claim
 * about real-time grid carbon intensity.
 */
export function evaluateResourceEconomics(input: ResourceEconomicsInput): ResourceEconomicsDecision {
  if (input.energyBudget !== undefined && input.energyCost > input.energyBudget) {
    return { allowed: false, reason: "ENERGY_BUDGET", priorityMultiplier: 0, deferred: true };
  }
  if (input.quotaBudget !== undefined && input.quotaCost > input.quotaBudget) {
    return { allowed: false, reason: "QUOTA_BUDGET", priorityMultiplier: 0, deferred: true };
  }
  if (input.carbonBudget !== undefined && input.carbonIntensity > input.carbonBudget) {
    return { allowed: false, reason: "CARBON_BUDGET", priorityMultiplier: 0, deferred: true };
  }

  const priorityMultiplier = Number((1 / Math.max(1, input.carbonIntensity)).toFixed(6));
  return { allowed: true, reason: "ALLOW", priorityMultiplier, deferred: false };
}
