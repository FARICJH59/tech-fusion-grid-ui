import { describe, expect, it } from "vitest";
import { createApplicationBuildPlan } from "./application-contract";
import { buildApplicationArtifactGraph } from "./application-graph";

describe("HOARE application artifact graph", () => {
  it("creates deterministic dependency waves", () => {
    const plan = createApplicationBuildPlan({
      tenantId: "tenant-1",
      projectId: "project-1",
      name: "inventory",
      description: "Inventory application",
    });

    const graph = buildApplicationArtifactGraph(plan);

    expect(graph.waves).toEqual([
      ["auth", "data", "events"],
      ["backend"],
      ["frontend"],
    ]);
    expect(graph.nodes.map((node) => node.id)).toEqual([
      "auth",
      "data",
      "events",
      "backend",
      "frontend",
    ]);
  });

  it("rejects circular dependencies", () => {
    const plan = createApplicationBuildPlan({
      tenantId: "tenant-1",
      projectId: "project-1",
      name: "inventory",
      description: "Inventory application",
    });

    plan.components[2].dependsOn = ["frontend"];
    expect(() => buildApplicationArtifactGraph(plan)).toThrow("Circular application component dependency detected");
  });
});
