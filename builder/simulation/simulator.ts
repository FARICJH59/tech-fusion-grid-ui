import type { ExecutionUnit, PasorPlan } from "../pasor/execution-plan";

export type SimulationRequest = {
  principal: { id: string; roles: string[] };
  tenant: { tenant_id: string; energy_quota: number; execution_quota: number };
  action?: string;
  allow_execution?: boolean;
};

export type SimulationResult = {
  schema: "hoare.simulation/v1";
  allowed: boolean;
  status: "PASS" | "DENY";
  reasons: string[];
  totals: { energy_cost: number; quota_cost: number };
  parallel_groups: string[][];
  ordered_units: string[];
};

function hasRole(roles: string[], accepted: string[]) {
  return accepted.some((role) => roles.includes(role));
}

export function simulatePasorPlan(plan: PasorPlan, request: SimulationRequest): SimulationResult {
  const reasons: string[] = [];
  const units = plan.execution_units;
  const ids = new Set(units.map((u) => u.unit_id));

  for (const unit of units) {
    for (const dependency of unit.dependencies) {
      if (!ids.has(dependency)) reasons.push(`MISSING_DEPENDENCY:${unit.unit_id}:${dependency}`);
    }
  }

  if (request.tenant.tenant_id !== plan.tenant_id) reasons.push("TENANT_MISMATCH");
  if (plan.totals.energy_cost > request.tenant.energy_quota) reasons.push("ENERGY_QUOTA_EXCEEDED");
  if (plan.totals.quota_cost > request.tenant.execution_quota) reasons.push("EXECUTION_QUOTA_EXCEEDED");
  if (!hasRole(request.principal.roles, ["admin", "operator", "builder"])) reasons.push("RBAC_DENIED");
  if (request.action && !["build", "test", "validate", "deploy"].includes(request.action)) reasons.push("GOVERNANCE_ACTION_DENIED");
  if (request.allow_execution === false) reasons.push("EXECUTION_NOT_AUTHORIZED");

  const remaining = new Map(units.map((u) => [u.unit_id, new Set(u.dependencies)]));
  const completed = new Set<string>();
  const parallel_groups: string[][] = [];
  while (completed.size < units.length) {
    const ready = [...remaining.entries()]
      .filter(([id, deps]) => !completed.has(id) && [...deps].every((dep) => completed.has(dep)))
      .map(([id]) => id);
    if (!ready.length) {
      reasons.push("DEPENDENCY_CYCLE");
      break;
    }
    parallel_groups.push(ready);
    ready.forEach((id) => completed.add(id));
  }

  return {
    schema: "hoare.simulation/v1",
    allowed: reasons.length === 0,
    status: reasons.length === 0 ? "PASS" : "DENY",
    reasons,
    totals: plan.totals,
    parallel_groups,
    ordered_units: parallel_groups.flat(),
  };
}
