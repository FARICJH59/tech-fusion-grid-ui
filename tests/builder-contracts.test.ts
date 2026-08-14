import assert from "node:assert/strict";
import test from "node:test";
import {
  buildDependencyGraph,
  canonicalHash,
  simulateUnits,
  type ExecutionUnit,
} from "../builder";

const units: ExecutionUnit[] = [
  {
    unit_id: "step1",
    command_id: "ml.load_data",
    parameters: { source: "qgps_sensor_db" },
    dependencies: [],
    energy_cost: 6,
    quota_cost: 1,
    tenant_id: "tenant_demo",
    project_id: "proj-ml-qae-001",
    execution_id: "exec_demo",
    simulation_hash: "pending",
    provenance_hash: "pending",
    status: "PLANNED",
  },
  {
    unit_id: "step2",
    command_id: "ml.clean_data",
    parameters: { missing_value_strategy: "interpolate" },
    dependencies: ["step1"],
    energy_cost: 8,
    quota_cost: 1,
    tenant_id: "tenant_demo",
    project_id: "proj-ml-qae-001",
    execution_id: "exec_demo",
    simulation_hash: "pending",
    provenance_hash: "pending",
    status: "PLANNED",
  },
];

test("builds dependency graph", () => {
  assert.deepEqual(buildDependencyGraph(units), {
    nodes: ["step1", "step2"],
    edges: [{ from: "step1", to: "step2" }],
  });
});

test("enforces energy and quota budgets before execution", () => {
  const result = simulateUnits(units, {
    energy_available: 20,
    quota_available: 3,
  });
  assert.equal(result.allowed, true);
  assert.equal(result.total_energy_cost, 14);
  assert.equal(result.total_quota_cost, 2);
});

test("canonical hash is independent of object key order", () => {
  assert.equal(
    canonicalHash({ b: 2, a: 1 }),
    canonicalHash({ a: 1, b: 2 }),
  );
});
