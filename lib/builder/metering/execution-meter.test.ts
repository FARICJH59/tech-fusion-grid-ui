import assert from "node:assert/strict";
import test from "node:test";
import { brainProposalToPasor } from "../pasor/brain-adapter";
import { meterExecution } from "./execution-meter";

test("meters executed units into quota, energy, carbon, and revenue", () => {
  const plan = brainProposalToPasor({
    project_id: "proj-1",
    tenant_id: "tenant-1",
    units: [{ command_id: "build.project", energy_cost: 10, quota_cost: 4 }],
  });

  const events = meterExecution(plan, [{
    unit_id: "unit_1",
    command_id: "build.project",
    status: "EXECUTED",
    reason: "OK",
    started_at: "2026-08-14T00:00:00.000Z",
    finished_at: "2026-08-14T00:00:01.000Z",
  }], {
    quotaUnitPriceUsd: 1,
    energyUnitPriceUsd: 0.2,
    carbonPriceUsdPerKg: 0.1,
    energyKwhPerCostUnit: 0.5,
    carbonKgPerKwh: 0.4,
  });

  assert.equal(events[0].quotaConsumed, 4);
  assert.equal(events[0].energyKwh, 5);
  assert.equal(events[0].carbonKg, 2);
  assert.equal(events[0].revenueUsd, 5.2);
});

test("does not bill denied or deferred work", () => {
  const plan = brainProposalToPasor({ project_id: "p", tenant_id: "t", units: [{ command_id: "x", energy_cost: 10, quota_cost: 5 }] });
  const events = meterExecution(plan, [{
    unit_id: "unit_1", command_id: "x", status: "DEFERRED", reason: "QUOTA", started_at: "x", finished_at: "x",
  }], { quotaUnitPriceUsd: 1, energyUnitPriceUsd: 1, carbonPriceUsdPerKg: 1, energyKwhPerCostUnit: 1, carbonKgPerKwh: 1 });
  assert.equal(events[0].revenueUsd, 0);
  assert.equal(events[0].quotaConsumed, 0);
});
