import assert from "node:assert/strict";
import test from "node:test";
import { brainProposalToPasor } from "../pasor/brain-adapter";
import { simulatePasorPlan } from "../simulation/pasor-simulator";
import { dispatchPasorPlan } from "./pasor-dispatcher";

test("executes READY units and schedules DEFER units", async () => {
  const plan = brainProposalToPasor({
    project_id: "proj-1",
    tenant_id: "tenant-1",
    units: [
      { command_id: "build.project", energy_cost: 2, quota_cost: 1 },
      { command_id: "test.project", dependencies: ["unit_1"], energy_cost: 1, quota_cost: 1 },
    ],
  });

  const simulation = await simulatePasorPlan(plan, (unit) => ({
    allowed: true,
    disposition: unit.command_id === "test.project" ? "DEFER" : "EXECUTE",
    reason: "TEST_GATE",
  }));

  const executed: string[] = [];
  const deferred: string[] = [];
  const records = await dispatchPasorPlan(
    plan,
    simulation,
    async (unit) => { executed.push(unit.unit_id); },
    async (unit) => { deferred.push(unit.unit_id); },
  );

  assert.deepEqual(executed, ["unit_1"]);
  assert.deepEqual(deferred, ["unit_2"]);
  assert.equal(records[0].status, "EXECUTED");
  assert.equal(records[1].status, "DEFERRED");
});

test("rejects a unit that has no simulation decision", async () => {
  const plan = brainProposalToPasor({ project_id: "p", tenant_id: "t", units: [{ command_id: "build.project" }] });
  await assert.rejects(
    dispatchPasorPlan(plan, { plan_hash: "x", decisions: [], total_energy_cost: 0, total_quota_cost: 0, execution_order: [] }, async () => {}, async () => {}),
    /UNSIMULATED_UNIT/,
  );
});
