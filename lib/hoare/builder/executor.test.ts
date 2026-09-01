import { describe, expect, it } from "vitest";
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

describe("BuilderExecutor", () => {
  it("executes a validated plan through a provider adapter", async () => {
    const result = await buildDefaultExecutor().execute(plan);
    expect(result.accepted).toBe(true);
    expect(result.operations).toHaveLength(4);
    expect(result.provider).toBe("hoare");
  });

  it("rejects plans that are not in building state", async () => {
    await expect(buildDefaultExecutor().execute({ ...plan, status: "approved" })).rejects.toThrow(
      "requires building status",
    );
  });

  it("rejects unsupported providers", async () => {
    await expect(
      buildDefaultExecutor().execute({ ...plan, deployment: { ...plan.deployment, provider: "unknown" } }),
    ).rejects.toThrow("No build provider adapter registered");
  });
});
