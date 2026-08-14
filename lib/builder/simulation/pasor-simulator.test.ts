import assert from "node:assert/strict";
import test from "node:test";
import { simulatePasorPlan } from "./pasor-simulator";
import type { PasorPlan } from "../pasor/brain-adapter";

const plan: PasorPlan = {
  project_id: "proj-1",
  tenant_id: "ten_0123456789abcdef0123456789abcdef",
  execution_units: [
    { unit_id: "unit_1", command_id: "build", parameters: {}, dependencies: [], energy_cost: 5, quota_cost: 2, optional: false, simulation_hash: "a", provenance_hash: "b" },
    { unit_id: "unit_2", command_id: "test", parameters: {}, dependencies: ["unit_1"], energy_cost: 3, quota_cost: 1, optional: false, simulation_hash: "c", provenance_hash: "d" },
    { unit_id: "unit_3", command_id: "lint", parameters: {}, dependencies: [], energy_cost: 1, quota_cost: 1, optional: true, simulation_hash: "e", provenance_hash: "f" },
  ],
};

test("simulates independent units in parallel waves and dependencies afterward", async () => {
  const result = await simulatePasorPlan(plan, () => ({ allowed: true, disposition: "EXECUTE" }));
  assert.deepEqual(result.execution_order, [["unit_1", "unit_3"], ["unit_2"]]);
  assert.equal(result.total_energy_cost, 9);
  assert.equal(result.total_quota_cost, 4);
  assert.equal(result.decisions.every((d) => d.status === "READY"), true);
});

test("propagates a denied unit to downstream work", async () => {
  const result = await simulatePasorPlan(plan, (unit) =>
    unit.unit_id === "unit_1" ? { allowed: false, disposition: "DENY", reason: "QUOTA" } : { allowed: true, disposition: "EXECUTE" },
  );
  assert.equal(result.decisions.find((d) => d.unit_id === "unit_1")?.status, "DENY");
  assert.equal(result.decisions.find((d) => d.unit_id === "unit_2")?.reason, "UPSTREAM_DENIED");
});
