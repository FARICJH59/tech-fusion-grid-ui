import { createHash } from "node:crypto";

export type ExecutionUnit = {
  unit_id: string;
  command_id: string;
  parameters: Record<string, unknown>;
  dependencies: string[];
  energy_cost: number;
  quota_cost: number;
  optional?: boolean;
  simulation_hash: string;
  provenance_hash: string;
};

export type PasorPlan = {
  schema: "hoare.pasor/v1";
  project_id: string;
  tenant_id: string;
  execution_units: ExecutionUnit[];
  totals: { energy_cost: number; quota_cost: number };
};

function hash(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

export function createPasorPlan(input: {
  project_id: string;
  tenant_id: string;
  execution_units: Array<Omit<ExecutionUnit, "simulation_hash" | "provenance_hash">>;
}): PasorPlan {
  const execution_units = input.execution_units.map((unit) => ({
    ...unit,
    simulation_hash: hash({ unit_id: unit.unit_id, command_id: unit.command_id, parameters: unit.parameters, dependencies: unit.dependencies, energy_cost: unit.energy_cost, quota_cost: unit.quota_cost }),
    provenance_hash: hash({ tenant_id: input.tenant_id, project_id: input.project_id, unit }),
  }));

  return {
    schema: "hoare.pasor/v1",
    project_id: input.project_id,
    tenant_id: input.tenant_id,
    execution_units,
    totals: {
      energy_cost: execution_units.reduce((sum, unit) => sum + unit.energy_cost, 0),
      quota_cost: execution_units.reduce((sum, unit) => sum + unit.quota_cost, 0),
    },
  };
}
