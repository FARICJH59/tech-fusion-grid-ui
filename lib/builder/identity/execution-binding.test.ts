import assert from "node:assert/strict";
import test from "node:test";
import { bindExecutionUnit, verifyExecutionBinding } from "./execution-binding";

const tenantId = "ten_0123456789abcdef0123456789abcdef";
const unit = {
  unit_id: "unit_1",
  command_id: "repo.build",
  energy_cost: 5,
  quota_cost: 2,
  simulation_hash: "sim-1",
  provenance_hash: "prov-1",
};

const context = {
  tenantId,
  projectId: "project-1",
  principalId: "principal-1",
};

test("binds an execution unit to tenant, project and principal", () => {
  const bound = bindExecutionUnit(unit, context);
  assert.equal(bound.execution_binding_hash.length, 64);
  assert.equal(verifyExecutionBinding(bound, context), true);
  assert.equal(verifyExecutionBinding(bound, { ...context, projectId: "project-2" }), false);
});

test("requires verified repository access and tenant alignment", () => {
  const repository = {
    tenantId,
    owner: "example",
    repo: "project",
    ref: "main",
    repositoryId: 42,
    provenanceHash: "repo-prov",
  };

  assert.throws(() => bindExecutionUnit(unit, { ...context, githubRepository: repository }), /REPOSITORY_ACCESS_NOT_VERIFIED/);
  assert.throws(() => bindExecutionUnit(unit, {
    ...context,
    githubRepository: { ...repository, tenantId: "ten_abcdefabcdefabcdefabcdefabcdefab" },
    repositoryAccessVerified: true,
  }), /TENANT_REPOSITORY_MISMATCH/);

  const bound = bindExecutionUnit(unit, { ...context, githubRepository: repository, repositoryAccessVerified: true });
  assert.equal(verifyExecutionBinding(bound, { ...context, githubRepository: repository, repositoryAccessVerified: true }), true);
});
