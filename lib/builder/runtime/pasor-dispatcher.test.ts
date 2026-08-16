import assert from "node:assert/strict";
import test from "node:test";
import { brainProposalToPasor } from "../pasor/brain-adapter";
import { simulatePasorPlan } from "../simulation/pasor-simulator";
import { dispatchPasorPlan } from "./pasor-dispatcher";

const authorization = {
  principal: { id: "operator-1", roles: ["operator"] },
  entitlement: { tenantId: "tenant-1", active: true, capabilities: ["build.project", "test.project", "lint.project"], quotaRemaining: 100 },
};

test("executes READY units and schedules DEFER units", async () => {
  const plan = brainProposalToPasor({
    project_id: "proj-1", tenant_id: "tenant-1",
    units: [
      { command_id: "build.project", energy_cost: 2, quota_cost: 1 },
      { command_id: "test.project", dependencies: ["unit_1"], energy_cost: 1, quota_cost: 1 },
    ],
  });
  const simulation = await simulatePasorPlan(plan, (unit) => ({ allowed: true, disposition: unit.command_id === "test.project" ? "DEFER" : "EXECUTE", reason: "TEST_GATE" }));
  const executed: string[] = [];
  const deferred: string[] = [];
  const records = await dispatchPasorPlan(plan, simulation, async (unit) => { executed.push(unit.unit_id); }, async (unit) => { deferred.push(unit.unit_id); }, authorization);
  assert.deepEqual(executed, ["unit_1"]);
  assert.deepEqual(deferred, ["unit_2"]);
  assert.equal(records[0].status, "EXECUTED");
  assert.equal(records[1].status, "DEFERRED");
});

test("rejects a unit that has no simulation decision", async () => {
  const plan = brainProposalToPasor({ project_id: "p", tenant_id: "t", units: [{ command_id: "build.project" }] });
  await assert.rejects(dispatchPasorPlan(plan, { plan_hash: "x", decisions: [], total_energy_cost: 0, total_quota_cost: 0, execution_order: [] }, async () => {}, async () => {}, authorization), /UNSIMULATED_UNIT/);
});

test("blocks runtime execution when tenant capability is missing", async () => {
  const plan = brainProposalToPasor({ project_id: "p", tenant_id: "tenant-1", units: [{ command_id: "deploy.production", quota_cost: 2 }] });
  const simulation = await simulatePasorPlan(plan, () => ({ allowed: true, disposition: "EXECUTE", reason: "SIMULATED" }));
  let executed = false;
  const records = await dispatchPasorPlan(plan, simulation, async () => { executed = true; }, async () => {}, authorization);
  assert.equal(executed, false);
  assert.equal(records[0].status, "DENIED");
  assert.equal(records[0].reason, "CAPABILITY_DENIED");
});

test("runs independent units in the same simulation wave concurrently", async () => {
  const plan = brainProposalToPasor({
    project_id: "proj-1",
    tenant_id: "tenant-1",
    units: [
      { command_id: "build.project", energy_cost: 1, quota_cost: 1 },
      { command_id: "lint.project", energy_cost: 1, quota_cost: 1 },
      { command_id: "test.project", dependencies: ["unit_1"], energy_cost: 1, quota_cost: 1 },
    ],
  });
  const simulation = await simulatePasorPlan(plan, () => ({ allowed: true, disposition: "EXECUTE", reason: "READY" }));
  let active = 0;
  let maxActive = 0;
  const records = await dispatchPasorPlan(
    plan,
    simulation,
    async () => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      await new Promise((resolve) => setTimeout(resolve, 5));
      active -= 1;
    },
    async () => {},
    authorization,
  );

  assert.ok(maxActive >= 2);
  assert.deepEqual(records.map((record) => record.status), ["EXECUTED", "EXECUTED", "EXECUTED"]);
});

test("does not execute downstream work after an upstream failure", async () => {
  const plan = brainProposalToPasor({
    project_id: "proj-1",
    tenant_id: "tenant-1",
    units: [
      { command_id: "build.project", energy_cost: 1, quota_cost: 1 },
      { command_id: "test.project", dependencies: ["unit_1"], energy_cost: 1, quota_cost: 1 },
    ],
  });
  const simulation = await simulatePasorPlan(plan, () => ({ allowed: true, disposition: "EXECUTE", reason: "READY" }));
  const executed: string[] = [];
  const records = await dispatchPasorPlan(
    plan,
    simulation,
    async (unit) => {
      executed.push(unit.unit_id);
      if (unit.unit_id === "unit_1") throw new Error("BUILD_FAILED");
    },
    async () => {},
    authorization,
  );

  assert.deepEqual(executed, ["unit_1"]);
  assert.equal(records[0].status, "FAILED");
  assert.equal(records[1].status, "DENIED");
  assert.equal(records[1].reason, "UPSTREAM_NOT_EXECUTED");
});

test("rejects a forged or incomplete simulation order", async () => {
  const plan = brainProposalToPasor({
    project_id: "proj-1",
    tenant_id: "tenant-1",
    units: [
      { command_id: "build.project" },
      { command_id: "test.project", dependencies: ["unit_1"] },
    ],
  });
  const simulation = await simulatePasorPlan(plan, () => ({ allowed: true, disposition: "EXECUTE", reason: "READY" }));
  await assert.rejects(
    dispatchPasorPlan(plan, { ...simulation, execution_order: [["unit_2"], ["unit_1"]] }, async () => {}, async () => {}, authorization),
    /INVALID_SIMULATION_ORDER/,
  );
});
