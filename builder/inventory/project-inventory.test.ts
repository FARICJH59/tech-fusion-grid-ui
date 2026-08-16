import assert from "node:assert/strict";
import test from "node:test";
import { buildProjectInventory } from "./project-inventory";

test("inventory detects cross-language builder projects without reading file contents", () => {
  const result = buildProjectInventory({
    tenant_id: "ten_0123456789abcdef0123456789abcdef",
    project_id: "proj_test",
    owner: "FARICJH59",
    repository: "example",
    revision: "abc123",
    files: [
      "Cargo.toml",
      "src/main.rs",
      "engine.cpp",
      "include/engine.hpp",
      "app/main.tsx",
      "package.json",
      "next.config.ts",
      ".github/workflows/ci.yml",
      "aegisc/compiler.aegis",
      "mcp/pasor/index.ts",
    ],
  });

  assert.deepEqual(result.detected.languages.sort(), ["c_cpp", "rust", "typescript"]);
  assert.equal(result.detected.has_cpp, true);
  assert.equal(result.detected.has_aegisc, true);
  assert.equal(result.detected.has_pasor, true);
  assert.equal(result.detected.has_github_actions, true);
  assert.ok(result.provenance_hash.length === 64);
  assert.equal(result.files.some((file) => file.includes("secret")), false);
});
