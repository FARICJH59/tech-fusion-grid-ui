import assert from "node:assert/strict";
import test from "node:test";
import { buildProjectInventory } from "../builder/inventory/project-inventory";
import { createPasorPlan } from "../builder/pasor/execution-plan";
import { verifyAegiscPlan } from "../agentfusion/aegisc/execution-verifier";

test("AEGISC verifies a PASOR execution plan", () => {
  const inventory = buildProjectInventory({ tenant_id: "ten_a", project_id: "proj_a", owner: "FARICJH59", repository: "repo", revision: "abc", files: ["package.json", "aegisc/main.aegis"] });
  const plan = createPasorPlan(inventory);
  const result = verifyAegiscPlan(plan);
  assert.equal(result.valid, true);
});

test("AEGISC rejects a tampered plan hash", () => {
  const result = verifyAegiscPlan({ schema: "hoare.pasor-plan/v1", tenant_id: "t", project_id: "p", execution_units: [], plan_hash: "0".repeat(64) });
  assert.equal(result.valid, false);
  assert.equal(result.planHashValid, false);
});
