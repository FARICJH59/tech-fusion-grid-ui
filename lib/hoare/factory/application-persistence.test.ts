import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { persistApplicationArtifacts } from "./application-persistence";

describe("application artifact persistence", () => {
  it("persists a generated frontend/backend workspace with a stable digest", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "hoare-app-"));
    const result = await persistApplicationArtifacts(
      "inventory-001",
      [
        { path: "frontend/index.html", content: "<main>Inventory</main>" },
        { path: "backend/README.md", content: "# API" },
        { path: "application.manifest.json", content: '{"version":1}' },
      ],
      root,
    );

    expect(result.files).toEqual([
      "frontend/index.html",
      "backend/README.md",
      "application.manifest.json",
    ]);
    expect(result.artifactDigest).toMatch(/^[a-f0-9]{64}$/);
    await expect(readFile(path.join(result.rootDirectory, "frontend/index.html"), "utf8"))
      .resolves.toBe("<main>Inventory</main>");
  });

  it("rejects traversal paths", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "hoare-app-"));
    await expect(
      persistApplicationArtifacts("inventory-001", [{ path: "../escape.txt", content: "x" }], root),
    ).rejects.toThrow("Unsafe application artifact path");
  });
});
