import assert from "node:assert/strict";
import test from "node:test";
import { GovernedExecutionRevenueMeter } from "./revenue-meter";

test("only executed units become billable", () => {
  const meter = new GovernedExecutionRevenueMeter({
    executionUnitUsd: 0.01,
    energyUnitUsd: 0.002,
    quotaUnitUsd: 0.01,
  });

  meter.record({
    tenantId: "ten_0123456789abcdef0123456789abcdef",
    projectId: "proj_1",
    unitId: "u1",
    commandId: "build.ts",
    energyCost: 10,
    quotaCost: 2,
    status: "SIMULATED",
  });
  meter.record({
    tenantId: "ten_0123456789abcdef0123456789abcdef",
    projectId: "proj_1",
    unitId: "u2",
    commandId: "test.ts",
    energyCost: 20,
    quotaCost: 3,
    status: "EXECUTED",
  });

  const snapshot = meter.snapshot("ten_0123456789abcdef0123456789abcdef", "proj_1");
  assert.equal(snapshot.executionUnits, 1);
  assert.equal(snapshot.energyUnits, 20);
  assert.equal(snapshot.quotaUnits, 3);
  assert.equal(snapshot.billableUsd, 0.09);
});

test("tenant isolation is enforced by the meter", () => {
  const meter = new GovernedExecutionRevenueMeter();
  meter.record({
    tenantId: "tenant-a",
    projectId: "project-a",
    unitId: "u1",
    commandId: "deploy",
    energyCost: 10,
    quotaCost: 2,
    status: "EXECUTED",
  });

  assert.equal(meter.snapshot("tenant-b").billableUsd, 0);
});
