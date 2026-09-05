import test from "node:test";
import assert from "node:assert/strict";
import { createApplicationBuildPlan } from "./application-contract";
import { buildApplicationArtifactGraph } from "./application-graph";

test("HOARE application artifact graph creates deterministic dependency waves", () => {
  const plan = createApplicationBuildPlan({ tenantId: "tenant-1", projectId: "project-1", name: "inventory", description: "Inventory application" });
  const graph = buildApplicationArtifactGraph(plan);
  assert.deepEqual(graph.waves, [["auth", "data", "events"], ["backend"], ["frontend"]]);
  assert.deepEqual(graph.nodes.map((node) => node.id), ["auth", "data", "events", "backend", "frontend"]);
});

test("HOARE application artifact graph rejects circular dependencies", () => {
  const plan = createApplicationBuildPlan({ tenantId: "tenant-1", projectId: "project-1", name: "inventory", description: "Inventory application" });
  plan.components[2].dependsOn = ["frontend"];
  assert.throws(() => buildApplicationArtifactGraph(plan), /Circular application component dependency detected/);
});
