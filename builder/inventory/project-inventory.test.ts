import test from "node:test";
import assert from "node:assert/strict";
import { buildProjectInventory } from "./project-inventory";

test("project inventory is deterministic and deduplicates files", () => {
  const first = buildProjectInventory({
    tenant_id: "ten_0123456789abcdef0123456789abcdef",
    project_id: "proj_123",
    owner: "FARICJH59",
    repository: "sim-project",
    revision: "abc123",
    files: ["src/main.ts", "package.json", "src/main.ts"],
  });
  const second = buildProjectInventory({
    tenant_id: "ten_0123456789abcdef0123456789abcdef",
    project_id: "proj_123",
    owner: "FARICJH59",
    repository: "sim-project",
    revision: "abc123",
    files: ["package.json", "src/main.ts"],
  });

  assert.deepEqual(first.files, ["package.json", "src/main.ts"]);
  assert.equal(first.inventory_hash, second.inventory_hash);
});
