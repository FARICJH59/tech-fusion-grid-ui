import assert from "node:assert/strict";
import test from "node:test";
import { createGitHubImportPlan } from "./github-import-adapter";

test("creates a deterministic read-only GitHub inspection plan", () => {
  const plan = createGitHubImportPlan({
    url: "https://github.com/FARICJH59/tech-fusion-grid-ui.git",
    ref: "main",
    tenant_id: "ten_demo",
    project_id: "proj_demo",
  });

  assert.equal(plan.source.owner, "FARICJH59");
  assert.equal(plan.source.repository, "tech-fusion-grid-ui");
  assert.equal(plan.source.ref, "main");
  assert.equal(plan.execution_required, false);
  assert.equal(plan.provenance_hash.length, 64);
});

test("rejects non-GitHub URLs", () => {
  assert.throws(() => createGitHubImportPlan({
    url: "https://example.com/org/repo.git",
    tenant_id: "ten_demo",
    project_id: "proj_demo",
  }), /UNSUPPORTED_GITHUB_URL/);
});
