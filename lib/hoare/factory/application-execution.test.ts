import test from "node:test";
import assert from "node:assert/strict";
import { createApplicationBuildPlan } from "./application-contract";
import { executeNativeApplication } from "./application-execution";

test("HOARE native application execution runs the generated application through the governed builder lifecycle", async () => {
  const plan = createApplicationBuildPlan({ tenantId: "tenant-1", projectId: "project-1", name: "inventory", description: "Inventory application" });
  const result = await executeNativeApplication(plan);
  assert.equal(result.lifecycle, "ready");
  assert.equal(result.builderPlan.status, "ready");
  assert.deepEqual(result.records.map((record) => record.action), ["approve", "start", "complete"]);
  assert.equal(result.build.accepted, true);
  assert.equal(result.build.provider, "hoare");
  assert.ok(result.workspace.files.map((file) => file.path).includes("frontend/app/page.tsx"));
  assert.ok(result.workspace.files.map((file) => file.path).includes("backend/src/server.ts"));
  assert.match(result.workspace.digest, /^[a-f0-9]{64}$/);
});
