import assert from "node:assert/strict";
import test from "node:test";
import { buildProjectInventory } from "../inventory/project-inventory";
import { createPasorPlan } from "./execution-plan";

test("PASOR creates deterministic governed execution units", () => {
  const inventory = buildProjectInventory({
    tenant_id: "ten_0123456789abcdef0123456789abcdef",
    project_id: "proj_qae",
    owner: "FARICJH59",
    repository: "qae-project",
    revision: "abc123",
    files: ["package.json", "src/main.ts", "engine.cpp", "aegisc/main.aegis", "mcp/pasor/index.ts"],
  });

  const plan = createPasorPlan(inventory);
  assert.equal(plan.schema, "hoare.pasor-plan/v1");
  assert.ok(plan.execution_units.length >= 7);
  assert.ok(plan.execution_units.every((u) => u.simulation_hash.length === 64));
  assert.ok(plan.execution_units.every((u) => u.provenance_hash.length === 64));
  assert.ok(plan.execution_units.find((u) => u.unit_id === "cpp-build"));
  assert.ok(plan.execution_units.find((u) => u.unit_id === "aegisc-verify"));
  assert.ok(plan.execution_units.find((u) => u.unit_id === "pasor-validate"));
  assert.ok(plan.execution_units.find((u) => u.unit_id === "build")?.dependencies.includes("dependencies"));
  assert.ok(plan.totals.energy_cost > 0);
  assert.ok(plan.totals.quota_cost > 0);
});
