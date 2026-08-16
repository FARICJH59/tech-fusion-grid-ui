import type { ExecutionUnit, PasorPlan } from "../pasor/brain-adapter";

export type SimulationDecision = {
  unit_id: string;
  status: "READY" | "DEFER" | "DENY";
  reason: string;
};

export type SimulationResult = {
  plan_hash: string;
  decisions: SimulationDecision[];
  total_energy_cost: number;
  total_quota_cost: number;
  execution_order: string[][];
};

type Gate = (unit: ExecutionUnit) => { allowed: boolean; disposition?: "EXECUTE" | "DEFER" | "DENY"; reason?: string };

function stable(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  const object = value as Record<string, unknown>;
  return `{${Object.keys(object).sort().map((k) => `${JSON.stringify(k)}:${stable(object[k])}`).join(",")}}`;
}

async function digest(value: unknown): Promise<string> {
  const bytes = new TextEncoder().encode(stable(value));
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Simulates a PASOR DAG without invoking any runtime or provider. */
export async function simulatePasorPlan(plan: PasorPlan, gate: Gate): Promise<SimulationResult> {
  const ids = new Set(plan.execution_units.map((u) => u.unit_id));
  const decisions: SimulationDecision[] = [];
  const order: string[][] = [];
  const remaining = new Map(plan.execution_units.map((u) => [u.unit_id, u]));
  const completed = new Set<string>();

  for (const unit of plan.execution_units) {
    for (const dependency of unit.dependencies) {
      if (!ids.has(dependency)) throw new Error(`UNKNOWN_DEPENDENCY:${unit.unit_id}:${dependency}`);
    }
  }

  while (remaining.size) {
    const ready = [...remaining.values()].filter((unit) => unit.dependencies.every((dep) => completed.has(dep)));
    if (!ready.length) throw new Error("CYCLIC_OR_BLOCKED_DEPENDENCY_GRAPH");

    order.push(ready.map((u) => u.unit_id));
    for (const unit of ready) {
      const result = gate(unit);
      const status = result.allowed ? "READY" : result.disposition === "DEFER" ? "DEFER" : "DENY";
      decisions.push({ unit_id: unit.unit_id, status, reason: result.reason ?? "SIMULATION_GATE" });
      remaining.delete(unit.unit_id);
      if (status === "READY" || status === "DEFER") completed.add(unit.unit_id);
    }

    if (ready.some((unit) => {
      const d = decisions.find((x) => x.unit_id === unit.unit_id)!;
      return d.status === "DENY";
    })) {
      for (const unit of remaining.values()) {
        decisions.push({ unit_id: unit.unit_id, status: "DENY", reason: "UPSTREAM_DENIED" });
      }
      break;
    }
  }

  return {
    plan_hash: await digest({ project_id: plan.project_id, tenant_id: plan.tenant_id, execution_units: plan.execution_units }),
    decisions,
    total_energy_cost: plan.execution_units.reduce((sum, u) => sum + u.energy_cost, 0),
    total_quota_cost: plan.execution_units.reduce((sum, u) => sum + u.quota_cost, 0),
    execution_order: order,
  };
}
