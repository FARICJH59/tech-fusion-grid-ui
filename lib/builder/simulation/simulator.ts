import type { PasorPlan } from "../pasor/execution-plan";

export type SimulationRequest = {
  principal: { id: string; role: "viewer" | "operator" | "admin" | "service" };
  tenant: { tenant_id: string; energy_quota: number; execution_quota: number };
  required_role?: "viewer" | "operator" | "admin" | "service";
  action?: "build" | "test" | "validate" | "deploy";
};

export type SimulationResult = {
  schema: "hoare.simulation/v1";
  allowed: boolean;
  status: "PASS" | "DENY";
  reasons: string[];
  totals: PasorPlan["totals"];
  parallel_groups: string[][];
  ordered_units: string[];
};

const roleRank = { viewer: 1, operator: 2, admin: 3, service: 4 } as const;

export function simulatePasorPlan(plan: PasorPlan, request: SimulationRequest): SimulationResult {
  const reasons: string[] = [];
  const ids = new Set(plan.execution_units.map((unit) => unit.unit_id));

  for (const unit of plan.execution_units) {
    for (const dependency of unit.dependencies) {
      if (!ids.has(dependency)) reasons.push(`MISSING_DEPENDENCY:${unit.unit_id}:${dependency}`);
    }
  }

  if (request.tenant.tenant_id !== plan.tenant_id) reasons.push("TENANT_MISMATCH");
  if (plan.totals.energy_cost > request.tenant.energy_quota) reasons.push("ENERGY_QUOTA_EXCEEDED");
  if (plan.totals.quota_cost > request.tenant.execution_quota) reasons.push("EXECUTION_QUOTA_EXCEEDED");

  const requiredRole = request.required_role ?? "viewer";
  if (roleRank[request.principal.role] < roleRank[requiredRole]) reasons.push("RBAC_DENIED");
  if (request.action && !["build", "test", "validate", "deploy"].includes(request.action)) reasons.push("GOVERNANCE_ACTION_DENIED");

  const completed = new Set<string>();
  const parallel_groups: string[][] = [];
  while (completed.size < plan.execution_units.length) {
    const ready = plan.execution_units
      .filter((unit) => !completed.has(unit.unit_id) && unit.dependencies.every((dep) => completed.has(dep)))
      .map((unit) => unit.unit_id);
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
