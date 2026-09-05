import test from "node:test";
import assert from "node:assert/strict";
import { createApplicationBuildPlan, validateApplicationBuildPlan } from "./application-contract";

test("HOARE native application factory builds a stable release plan", () => {
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
  assert.equal(plan.target, "owned-runtime");
  assert.deepEqual(plan.components.map((component) => component.id), ["frontend", "backend", "data", "auth", "events"]);
  assert.match(plan.releaseDigest, /^[a-f0-9]{64}$/);
});

test("HOARE native application factory rejects duplicate and missing dependencies", () => {
  const plan = createApplicationBuildPlan({ tenantId: "tenant-1", projectId: "project-1", name: "inventory", description: "Inventory application" });
  plan.components.push({ ...plan.components[0], id: "frontend" });
  assert.throws(() => validateApplicationBuildPlan(plan), /Duplicate component/);
  plan.components.pop();
  plan.components[0].dependsOn = ["missing"];
  assert.throws(() => validateApplicationBuildPlan(plan), /Missing component dependency/);
});
