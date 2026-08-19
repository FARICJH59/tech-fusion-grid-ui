import assert from "node:assert/strict";
import test from "node:test";

import { compileAwsIamDryRun } from "../lib/enterprise/aws-iam-dry-run";
import { isAwsPreflightReady, runAwsPreflight } from "../lib/enterprise/aws-preflight";

function iamPlan() {
  return compileAwsIamDryRun({
    provider: "aws",
    roleBoundary: "tenant-agent",
    credentialStrategy: "temporary",
    permissions: ["model.invoke"],
    forbidden: ["iam.*", "admin.*", "long-lived-credentials"],
  });
}

test("AWS preflight reaches ready without enabling mutation", () => {
  const result = runAwsPreflight({
    authenticated: true,
    accountId: "123456789012",
    region: "us-east-1",
    allowedRegions: ["us-east-1", "us-west-2"],
    tenantId: "tenant-a",
    iamPlan: iamPlan(),
  });

  assert.equal(result.status, "ready");
  assert.equal(result.mutationAllowed, false);
  assert.equal(isAwsPreflightReady(result), true);
});

test("AWS preflight blocks unauthenticated or disallowed environments", () => {
  const result = runAwsPreflight({
    authenticated: false,
    accountId: null,
    region: "eu-west-1",
    allowedRegions: ["us-east-1"],
    tenantId: "tenant-a",
    iamPlan: iamPlan(),
  });

  assert.equal(result.status, "blocked");
  assert.ok(result.reasons.includes("preflight:authenticated"));
  assert.ok(result.reasons.includes("preflight:account"));
  assert.ok(result.reasons.includes("preflight:region"));
  assert.equal(result.mutationAllowed, false);
});
