import assert from "node:assert/strict";
import test from "node:test";

import { executeApprovedAwsRole, rollbackApprovedAwsRole } from "../lib/enterprise/aws-role-execution-adapter";
import type { AwsApprovedExecutionPlan } from "../lib/enterprise/aws-approved-execution";

const plan: AwsApprovedExecutionPlan = {
  provider: "aws",
  mode: "approved-single-operation",
  request: {
    action: "iam.create-role",
    tenantId: "tenant-a",
    roleName: "hoare-tenant-agent-tenant-a",
    trustPolicyHash: "sha256:example",
    permissionsBoundaryArn: "arn:aws:iam::123456789012:policy/HOARETenantBoundary",
  },
  rollback: { required: true, action: "iam.delete-role" },
  mutationAllowed: true,
};

test("AWS adapter executes only through the supplied credential-backed client", async () => {
  let created = false;
  const api = {
    async createRole(input: { RoleName: string; AssumeRolePolicyDocument: string; PermissionsBoundary: string }) {
      created = true;
      assert.equal(input.RoleName, plan.request.roleName);
      assert.equal(input.PermissionsBoundary, plan.request.permissionsBoundaryArn);
      return { Arn: "arn:aws:iam::123456789012:role/hoare-tenant-agent-tenant-a" };
    },
    async deleteRole(input: { RoleName: string }) {
      assert.equal(input.RoleName, plan.request.roleName);
      created = false;
    },
  };

  const result = await executeApprovedAwsRole(plan, api, '{"Version":"2012-10-17"}');
  assert.equal(created, true);
  assert.equal(result.status, "executed");
  assert.equal(result.rollbackAvailable, true);

  await rollbackApprovedAwsRole(plan, api);
  assert.equal(created, false);
});

test("AWS adapter refuses an unapproved mutation plan", async () => {
  await assert.rejects(() => executeApprovedAwsRole({ ...plan, mutationAllowed: false }, {
    async createRole() { return { Arn: "unused" }; },
    async deleteRole() {},
  }, "trust"));
});
