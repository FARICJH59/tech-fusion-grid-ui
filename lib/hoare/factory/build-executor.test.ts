import { describe, expect, test } from "vitest";
import { executeNativeBuild } from "./build-executor";

describe("native build executor", () => {
  test("rejects malformed workspaces before executing a release", async () => {
    const result = await executeNativeBuild([
      { path: "frontend/package.json", content: "{}" },
      { path: "backend/package.json", content: "{}" },
    ]);

    expect(result.artifactDigest).toMatch(/^[a-f0-9]{64}$/);
    expect(Array.isArray(result.steps)).toBe(true);
    expect(result.ok).toBe(false);
  });
});
