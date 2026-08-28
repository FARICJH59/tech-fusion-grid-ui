import assert from "node:assert/strict";
import test from "node:test";

import { buildProjectInventory } from "../../builder/inventory/project-inventory";
import { createPasorPlan } from "../../builder/pasor/execution-plan";
import {
  bindRoboticsMissionToPasor,
} from "./pasor-binding";

test("robotics mission binds to PASOR and HOARE receipt", () => {
  const inventory = buildProjectInventory({
    tenant_id: "ten_0123456789abcdef0123456789abcdef",
    project_id: "proj_robotics",
    owner: "robotics-demo",
    repository: "robotics-demo",
    revision: "robotics-001",
    files: [
      "robotics/core/types.ts",
      "robotics/core/policy.ts",
      "robotics/workflows/hoare-resupply.ts",
    ],
  });

  const plan = createPasorPlan(inventory);

  const unit = plan.execution_units.find(
    (candidate) => candidate.unit_id === "build",
  );

  assert.ok(unit);

  const binding = bindRoboticsMissionToPasor(plan, unit, {
    missionId: "resupply-pasor-001",
    vehicleId: "ugv-sim-001",
    origin: { x: 0, y: 0 },
    destination: { x: 10, y: 20 },
    payloadKg: 100,
    requestedBy: "hoare-demo",
  });

  assert.equal(binding.missionId, "resupply-pasor-001");
  assert.equal(binding.vehicleId, "ugv-sim-001");
  assert.equal(
    binding.executionUnitId,
    unit.unit_id,
  );

  assert.equal(
    binding.receipt.schema,
    "hoare.execution-receipt/v1",
  );

  assert.equal(
    binding.receipt.admission_status,
    "ADMITTED",
  );

  assert.equal(
    binding.receipt.pasor_plan_hash,
    plan.plan_hash,
  );

  assert.equal(
    binding.receipt.pasor_unit_id,
    unit.unit_id,
  );

  assert.equal(binding.simulationOnly, true);
  assert.equal(binding.mutationExecuted, false);
});

test("robotics workload binding changes receipt identity", () => {
  const inventory = buildProjectInventory({
    tenant_id: "ten_0123456789abcdef0123456789abcdef",
    project_id: "proj_robotics",
    owner: "robotics-demo",
    repository: "robotics-demo",
    revision: "robotics-002",
    files: [
      "robotics/core/types.ts",
      "robotics/core/policy.ts",
    ],
  });

  const plan = createPasorPlan(inventory);

  const unit = plan.execution_units.find(
    (candidate) => candidate.unit_id === "build",
  );

  assert.ok(unit);

  const first = bindRoboticsMissionToPasor(plan, unit, {
    missionId: "resupply-a",
    vehicleId: "ugv-sim-001",
    origin: { x: 0, y: 0 },
    destination: { x: 10, y: 20 },
    payloadKg: 100,
    requestedBy: "hoare-demo",
  });

  const second = bindRoboticsMissionToPasor(plan, unit, {
    missionId: "resupply-b",
    vehicleId: "ugv-sim-001",
    origin: { x: 0, y: 0 },
    destination: { x: 10, y: 20 },
    payloadKg: 100,
    requestedBy: "hoare-demo",
  });

  assert.notEqual(
    first.receipt.receipt_id,
    second.receipt.receipt_id,
  );

  assert.notEqual(
    first.receipt.receipt_hash,
    second.receipt.receipt_hash,
  );
});

test("robotics binding rejects missing vehicle identity", () => {
  const inventory = buildProjectInventory({
    tenant_id: "ten_0123456789abcdef0123456789abcdef",
    project_id: "proj_robotics",
    owner: "robotics-demo",
    repository: "robotics-demo",
    revision: "robotics-003",
    files: ["robotics/core/types.ts"],
  });

  const plan = createPasorPlan(inventory);

  const unit = plan.execution_units.find(
    (candidate) => candidate.unit_id === "build",
  );

  assert.ok(unit);

  assert.throws(
    () =>
      bindRoboticsMissionToPasor(plan, unit, {
        missionId: "resupply-invalid",
        vehicleId: "",
        origin: { x: 0, y: 0 },
        destination: { x: 10, y: 20 },
        payloadKg: 100,
        requestedBy: "hoare-demo",
      }),
    /robotics_vehicle_id_required/,
  );
});
