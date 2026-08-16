import assert from "node:assert/strict";
import test from "node:test";
import { planProject } from "../builder/pasor";

test("PASOR creates the QGPS anomaly execution graph", () => {
  const result = planProject({
    project_id: "proj-ml-qae-001",
    tenant_id: "tenant_test_001",
    goal: "Build a QGPS signal anomaly detector using a Quantum Autoencoder",
  });

  assert.equal(result.execution_units.length, 9);
  assert.deepEqual(result.execution_units[7].dependencies, ["step6", "step7"]);
  assert.equal(result.execution_units[6].optional, true);
  assert.equal(result.plan.total_energy_cost, 157);
  assert.equal(result.plan.total_quota_cost, 18);

  for (const item of result.execution_units) {
    assert.match(item.simulation_hash, /^[a-f0-9]{64}$/);
    assert.match(item.provenance_hash, /^[a-f0-9]{64}$/);
  }
});

test("PASOR rejects an energy budget before execution", () => {
  assert.throws(() => planProject({
    project_id: "budget-test",
    tenant_id: "tenant_test_001",
    goal: "Build a QGPS signal anomaly detector using a Quantum Autoencoder",
    constraints: { max_energy: 10 },
  }), /energy budget exceeded/);
});
