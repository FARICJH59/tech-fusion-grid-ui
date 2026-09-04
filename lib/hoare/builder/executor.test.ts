import test from "node:test";
import assert from "node:assert/strict";
import { buildDefaultExecutor } from "./executor";
import type { BuilderPlan } from "./types";

const plan: BuilderPlan = {
  id: "builder-test",
  intent: {
    tenantId: "tenant-test",
    name: "demo",
    description: "test build",
    resources: ["tenant", "infrastructure", "application", "agent"],
  },
  resources: [
    { kind: "tenant", name: "demo-tenant", dependsOn: [] },
    { kind: "infrastructure", name: "demo-infrastructure", dependsOn: ["demo-tenant"] },
    { kind: "application", name: "demo-application", dependsOn: ["demo-tenant", "demo-infrastructure"] },
    { kind: "agent", name: "demo-agent", dependsOn: ["demo-application"] },
  ],
  deployment: { provider: "hoare", environment: "development" },
  status: "building",
};

test("BuilderExecutor executes a validated plan through a provider adapter", async () => {
  const result = await buildDefaultExecutor().execute(plan);
  assert.equal(result.accepted, true);
  assert.equal(result.operations.length, 4);
  assert.equal(result.provider, "hoare");
});

test("BuilderExecutor rejects plans that are not in building state", async () => {
  await assert.rejects(
    buildDefaultExecutor().execute({ ...plan, status: "approved" }),
    /requires building status/,
  );
});

test("BuilderExecutor rejects unsupported providers", async () => {
  await assert.rejects(
    buildDefaultExecutor().execute({ ...plan, deployment: { ...plan.deployment, provider: "unknown" } }),
    /No build provider adapter registered/,
  );
});
