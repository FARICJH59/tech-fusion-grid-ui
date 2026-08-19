import assert from "node:assert/strict";
import test from "node:test";
import { CreateRoleCommand, DeleteRoleCommand, GetRoleCommand } from "@aws-sdk/client-iam";
import { executeLiveAwsRole } from "../lib/enterprise/aws-live-role-adapter";
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

test("live AWS adapter uses CreateRole/GetRole and verifies the created role", async () => {
  const sent: string[] = [];
  const client = {
    async send(command: CreateRoleCommand | GetRoleCommand | DeleteRoleCommand) {
      sent.push(command.constructor.name);
      if (command instanceof GetRoleCommand) {
        return { Role: { Arn: "arn:aws:iam::123456789012:role/hoare-tenant-agent-tenant-a", AssumeRolePolicyDocument: "%7B%7D" } };
      }
      return { Role: { Arn: "arn:aws:iam::123456789012:role/hoare-tenant-agent-tenant-a" } };
    },
  };

  const result = await executeLiveAwsRole(plan, '{"Version":"2012-10-17"}', client as never);
  assert.equal(result.verified, true);
  assert.deepEqual(sent, ["CreateRoleCommand", "GetRoleCommand"]);
});

test("live adapter refuses mutation when the execution gate is off", async () => {
  await assert.rejects(() => executeLiveAwsRole({ ...plan, mutationAllowed: false }, "trust", {} as never));
});
