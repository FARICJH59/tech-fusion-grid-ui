import assert from "node:assert/strict";
import test from "node:test";
import { createRepositoryBuildPlan } from "./repository-execution-planner";

test("creates deterministic governed build and test units from inventory", () => {
  const plan = createRepositoryBuildPlan(
    {
      repository: "example/project",
      ref: "main",
      languages: ["TypeScript"],
      frameworks: ["Next.js"],
      buildSystems: ["npm"],
      hasTests: true,
    },
    { projectId: "proj-1", tenantId: "tenant-1" },
  );

  assert.equal(plan.execution_units.length, 3);
  assert.equal(plan.execution_units[1].dependencies[0], "unit_1");
  assert.equal(plan.execution_units[2].dependencies[0], "unit_2");
  assert.equal(plan.execution_units.every((u) => u.simulation_hash.length === 64), true);
  assert.equal(plan.execution_units.every((u) => u.provenance_hash.length === 64), true);
});
