import assert from "node:assert/strict";
import test from "node:test";
import { buildProjectInventory } from "../inventory/project-inventory";
import { createPasorPlan } from "./execution-plan";
import { createHoareExecutionReceipt } from "./hoare-execution-receipt";

test("PASOR unit converts to a hash-bound HOARE receipt", () => {
  const inventory = buildProjectInventory({
    tenant_id: "ten_0123456789abcdef0123456789abcdef",
    project_id: "proj_qae",
    owner: "FARICJH59",
    repository: "qae-project",
    revision: "abc123",
    files: ["package.json", "src/main.ts", "mcp/pasor/index.ts"],
  });

  const plan = createPasorPlan(inventory);
  const unit = plan.execution_units.find((candidate) => candidate.unit_id === "build");
  assert.ok(unit);

  const receipt = createHoareExecutionReceipt(plan, unit, {
    runtime_kind: "python",
    workload_id: "workload-build-001",
    agent_id: "agent-build-001",
    node_id: "node-edge-001",
    pack_id: "pack-build-001",
    capabilities: ["build"],
    required_capability: "build",
    entrypoint: "tests.fixtures.execution_fixture:run",
  });

  assert.equal(receipt.schema, "hoare.execution-receipt/v1");
  assert.equal(receipt.admission_status, "ADMITTED");
  assert.equal(receipt.pasor_plan_hash, plan.plan_hash);
  assert.equal(receipt.pasor_unit_id, unit.unit_id);
  assert.equal(receipt.simulation_hash, unit.simulation_hash);
  assert.equal(receipt.provenance_hash, unit.provenance_hash);
  assert.equal(receipt.energy_cost, unit.energy_cost);
  assert.equal(receipt.quota_cost, unit.quota_cost);
  assert.equal(receipt.receipt_hash.length, 64);
});

test("receipt identity changes when workload binding changes", () => {
  const inventory = buildProjectInventory({
    tenant_id: "ten_0123456789abcdef0123456789abcdef",
    project_id: "proj_qae",
    owner: "FARICJH59",
    repository: "qae-project",
    revision: "abc123",
    files: ["package.json", "src/main.ts"],
  });

  const plan = createPasorPlan(inventory);
  const unit = plan.execution_units.find((candidate) => candidate.unit_id === "build");
  assert.ok(unit);

  const base = {
    runtime_kind: "python" as const,
    agent_id: "agent-build-001",
    node_id: "node-edge-001",
    pack_id: "pack-build-001",
    capabilities: ["build"],
    required_capability: "build",
    entrypoint: "tests.fixtures.execution_fixture:run",
  };

  const first = createHoareExecutionReceipt(plan, unit, {
    ...base,
    workload_id: "workload-a",
  });
  const second = createHoareExecutionReceipt(plan, unit, {
    ...base,
    workload_id: "workload-b",
  });

  assert.notEqual(first.receipt_id, second.receipt_id);
  assert.notEqual(first.receipt_hash, second.receipt_hash);
});
