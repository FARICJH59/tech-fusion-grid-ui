import { describe, expect, it } from "vitest";
import {
  createApplicationBuildPlan,
  validateApplicationBuildPlan,
} from "./application-contract";

describe("HOARE native application factory", () => {
  it("builds a frontend/backend application plan with a stable release digest", () => {
    const plan = createApplicationBuildPlan({
      tenantId: "tenant-1",
      projectId: "project-1",
      name: "inventory",
      description: "Inventory application",
      frontend: { framework: "owned-ui", routes: ["/", "/inventory"] },
      backend: { runtime: "node", apiStyle: "rest" },
      data: { provider: "managed-postgres", entities: ["products", "stock"] },
      targets: ["owned-runtime"],
    });

    validateApplicationBuildPlan(plan);
    expect(plan.target).toBe("owned-runtime");
    expect(plan.components.map((component) => component.id)).toEqual([
      "frontend",
      "backend",
      "data",
      "auth",
      "events",
    ]);
    expect(plan.releaseDigest).toMatch(/^[a-f0-9]{64}$/);
  });

  it("rejects duplicate and missing dependencies", () => {
    const plan = createApplicationBuildPlan({
      tenantId: "tenant-1",
      projectId: "project-1",
      name: "inventory",
      description: "Inventory application",
    });

    plan.components.push({
      ...plan.components[0],
      id: "frontend",
    });
    expect(() => validateApplicationBuildPlan(plan)).toThrow("Duplicate component");

    plan.components.pop();
    plan.components[0].dependsOn = ["missing"];
    expect(() => validateApplicationBuildPlan(plan)).toThrow("Missing component dependency");
  });
});
