import { createHash } from "node:crypto";

export type AegiscExecutionUnit = { unit_id: string; command_id: string; dependencies: string[]; simulation_hash: string; provenance_hash: string };
export type AegiscPlan = { schema: string; tenant_id: string; project_id: string; execution_units: AegiscExecutionUnit[]; plan_hash: string };
export type AegiscVerification = { valid: boolean; planHashValid: boolean; dependenciesValid: boolean; fencesValid: boolean; errors: string[] };

const SHA256 = /^[a-f0-9]{64}$/;

export function verifyAegiscPlan(plan: AegiscPlan): AegiscVerification {
  const errors: string[] = [];
  const planCore = { schema: plan.schema, project_id: plan.project_id, tenant_id: plan.tenant_id, execution_units: plan.execution_units };
  const expectedPlanHash = createHash("sha256").update(JSON.stringify(planCore)).digest("hex");
  const planHashValid = expectedPlanHash === plan.plan_hash;
  if (!planHashValid) errors.push("plan_hash mismatch");

  const ids = new Set(plan.execution_units.map((unit) => unit.unit_id));
  const dependenciesValid = plan.execution_units.every((unit) => unit.dependencies.every((dependency) => ids.has(dependency)));
  if (!dependenciesValid) errors.push("execution unit dependency references an unknown unit");

  const fencesValid = plan.execution_units.every((unit) => SHA256.test(unit.simulation_hash) && SHA256.test(unit.provenance_hash) && unit.command_id.length > 0);
  if (!fencesValid) errors.push("execution unit integrity/fencing fields are invalid");

  return { valid: errors.length === 0, planHashValid, dependenciesValid, fencesValid, errors };
}
