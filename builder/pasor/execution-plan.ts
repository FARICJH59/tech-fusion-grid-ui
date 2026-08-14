import { createHash } from "node:crypto";
import type { ProjectInventory } from "../inventory/project-inventory";

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
  schema: "hoare.pasor-plan/v1";
  project_id: string;
  tenant_id: string;
  execution_units: ExecutionUnit[];
  totals: { energy_cost: number; quota_cost: number };
  plan_hash: string;
};

function hash(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

export function createPasorPlan(inventory: ProjectInventory): PasorPlan {
  const units: ExecutionUnit[] = [];
  const add = (unit_id: string, command_id: string, parameters: Record<string, unknown>, dependencies: string[], energy_cost: number, quota_cost: number, optional = false) => {
    const base = { unit_id, command_id, parameters, dependencies, energy_cost, quota_cost, optional };
    units.push({
      ...base,
      ...(optional ? { optional: true } : {}),
      simulation_hash: hash({ phase: "simulation", ...base }),
      provenance_hash: hash({ phase: "provenance", tenant_id: inventory.tenant_id, project_id: inventory.project_id, inventory_hash: inventory.provenance_hash, ...base }),
    });
  };

  add("inventory", "project.inventory", { schema: inventory.schema }, [], 1, 1);
  add("dependencies", "project.resolve_dependencies", {}, ["inventory"], 2, 1);
  add("build", "project.build", { languages: inventory.detected.languages, frameworks: inventory.detected.frameworks }, ["dependencies"], 10, 3);
  add("test", "project.test", { github_actions: inventory.detected.has_github_actions }, ["build"], 8, 2);

  if (inventory.detected.has_cpp) {
    add("cpp-build", "cpp.build", { build_systems: inventory.detected.build_systems }, ["dependencies"], 15, 4);
    add("cpp-test", "cpp.test", {}, ["cpp-build"], 10, 3);
  }
  if (inventory.detected.has_aegisc) {
    add("aegisc-verify", "aegisc.verify", { execution_contract: true, plan_integrity: true, fencing: true }, ["build"], 12, 3);
  }
  if (inventory.detected.has_pasor) {
    add("pasor-validate", "pasor.validate", {}, ["inventory"], 3, 1);
  }

  const planCore = { schema: "hoare.pasor-plan/v1", project_id: inventory.project_id, tenant_id: inventory.tenant_id, execution_units: units };
  return {
    ...planCore,
    totals: {
      energy_cost: units.reduce((n, u) => n + u.energy_cost, 0),
      quota_cost: units.reduce((n, u) => n + u.quota_cost, 0),
    },
    plan_hash: hash(planCore),
  };
}
