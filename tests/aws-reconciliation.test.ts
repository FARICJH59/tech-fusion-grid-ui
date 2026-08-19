import assert from "node:assert/strict";
import test from "node:test";
import { reconcileAwsRole } from "../lib/enterprise/aws-reconciliation";

const desired = {
  roleName: "hoare-tenant-agent-tenant-a",
  roleArn: "arn:aws:iam::123456789012:role/hoare-tenant-agent-tenant-a",
  trustPolicyHash: "sha256:trust-v1",
  permissionsBoundaryArn: "arn:aws:iam::123456789012:policy/HOARETenantBoundary",
};

test("AWS state is compliant when observed state matches desired state", () => {
  const result = reconcileAwsRole(desired, { ...desired });
  assert.equal(result.status, "compliant");
  assert.equal(result.remediationRequired, false);
  assert.deepEqual(result.differences, []);
});

test("AWS drift is detected when trust policy or boundary changes", () => {
  const result = reconcileAwsRole(desired, {
    ...desired,
    trustPolicyHash: "sha256:tampered",
    permissionsBoundaryArn: null,
  });
  assert.equal(result.status, "drift");
  assert.equal(result.remediationRequired, true);
  assert.deepEqual(result.differences, ["trustPolicy", "permissionsBoundary"]);
});
