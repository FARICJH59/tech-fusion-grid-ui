import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import assert from "node:assert/strict";
import { persistApplicationArtifacts } from "./application-persistence";

test("application artifact persistence persists a generated workspace with a stable digest", async () => {
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
  assert.deepEqual(result.files, ["frontend/index.html", "backend/README.md", "application.manifest.json"]);
  assert.match(result.artifactDigest, /^[a-f0-9]{64}$/);
  await assert.doesNotReject(async () => {
    const content = await readFile(path.join(result.rootDirectory, "frontend/index.html"), "utf8");
    assert.equal(content, "<main>Inventory</main>");
  });
});

test("application artifact persistence rejects traversal paths", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hoare-app-"));
  await assert.rejects(
    persistApplicationArtifacts("inventory-001", [{ path: "../escape.txt", content: "x" }], root),
    /Unsafe application artifact path/,
  );
});
