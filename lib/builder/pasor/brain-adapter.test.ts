import assert from "node:assert/strict";
import test from "node:test";
import { brainProposalToPasor } from "./brain-adapter";

test("converts a brain proposal into canonical execution units", () => {
  const plan = brainProposalToPasor({
    project_id: "proj-1",
    tenant_id: "tenant-1",
    intent_summary: "Build an application",
    units: [
      { command_id: "build.project", parameters: { framework: "next" }, energy_cost: 5, quota_cost: 2 },
      { command_id: "test.project", dependencies: ["unit_1"], optional: true },
    ],
  });

  assert.equal(plan.execution_units.length, 2);
  assert.equal(plan.execution_units[0].unit_id, "unit_1");
  assert.equal(plan.execution_units[1].dependencies[0], "unit_1");
  assert.equal(plan.execution_units[0].simulation_hash.length, 64);
  assert.equal(plan.execution_units[0].provenance_hash.length, 64);
});

test("does not copy internal intelligence fields into the PASOR plan", () => {
  const proposal = {
    project_id: "proj-1",
    tenant_id: "tenant-1",
    units: [{ command_id: "build.project" }],
    internal_reasoning: "must never cross the boundary",
    memory: { private: true },
    secret: "redacted",
  } as never;

  const plan = brainProposalToPasor(proposal);
  assert.equal("internal_reasoning" in plan, false);
  assert.equal("memory" in plan, false);
  assert.equal("secret" in plan, false);
});
