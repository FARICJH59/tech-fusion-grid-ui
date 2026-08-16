import { describe, expect, it } from "vitest";
import { createApplicationBuildPlan } from "./application-contract";
import { executeNativeApplication } from "./application-execution";

describe("HOARE native application execution", () => {
  it("runs the generated application through the governed builder lifecycle", async () => {
    const plan = createApplicationBuildPlan({
      tenantId: "tenant-1",
      projectId: "project-1",
      name: "inventory",
      description: "Inventory application",
    });

    const result = await executeNativeApplication(plan);

    expect(result.lifecycle).toBe("ready");
    expect(result.builderPlan.status).toBe("ready");
    expect(result.records.map((record) => record.action)).toEqual([
      "approve",
      "start",
      "complete",
    ]);
    expect(result.build.accepted).toBe(true);
    expect(result.build.provider).toBe("hoare");
    expect(result.workspace.files.map((file) => file.path)).toContain("frontend/app/page.tsx");
    expect(result.workspace.files.map((file) => file.path)).toContain("backend/src/server.ts");
    expect(result.workspace.digest).toMatch(/^[a-f0-9]{64}$/);
  });
});
