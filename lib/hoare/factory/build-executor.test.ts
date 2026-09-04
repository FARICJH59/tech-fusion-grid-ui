import test from "node:test";
import assert from "node:assert/strict";
import { executeNativeBuild } from "./build-executor";

test("native build executor rejects malformed workspaces before executing a release", async () => {
  const result = await executeNativeBuild([
    { path: "frontend/package.json", content: "{}" },
    { path: "backend/package.json", content: "{}" },
  ]);
  assert.match(result.artifactDigest, /^[a-f0-9]{64}$/);
  assert.equal(Array.isArray(result.steps), true);
  assert.equal(result.ok, false);
});
