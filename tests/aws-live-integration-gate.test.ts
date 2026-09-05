import assert from "node:assert/strict";
import test from "node:test";

import { assertAwsLiveIntegrationEnabled, loadAwsLiveIntegrationConfig } from "../lib/enterprise/aws-live-integration-gate";
import type { AwsApprovedExecutionPlan } from "../lib/enterprise/aws-approved-execution";

const plan: AwsApprovedExecutionPlan = {
  provider: "aws",
  mode: "approved-single-operation",
  request: {
    action: "iam.create-role",
    tenantId: "tenant-a",
    roleName: "hoare-tenant-agent-tenant-a",
    trustPolicyHash: "sha256:test",
    permissionsBoundaryArn: "arn:aws:iam::123456789012:policy/HOARETenantBoundary",
  },
  rollback: { required: true, action: "iam.delete-role" },
  mutationAllowed: true,
};

test("AWS live integration is disabled by default", () => {
  const config = loadAwsLiveIntegrationConfig({});
  assert.equal(config.enabled, false);
  assert.throws(() => assertAwsLiveIntegrationEnabled(config, plan), /HOARE_AWS_LIVE_TEST=true/);
});

test("AWS live integration requires explicit environment and tenant match", () => {
  const config = loadAwsLiveIntegrationConfig({
    HOARE_AWS_LIVE_TEST: "true",
    AWS_REGION: "us-east-1",
    HOARE_AWS_EXECUTION_ROLE_ARN: "arn:aws:iam::123456789012:role/HOAREExecution",
    HOARE_TEST_TENANT: "tenant-a",
  });
  assert.doesNotThrow(() => assertAwsLiveIntegrationEnabled(config, plan));

  assert.throws(() => assertAwsLiveIntegrationEnabled({ ...config, tenantId: "tenant-b" }, plan), /tenant/);
});
