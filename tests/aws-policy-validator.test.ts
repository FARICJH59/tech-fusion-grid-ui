import assert from "node:assert/strict";
import test from "node:test";

import { compileAwsIamDryRun } from "../lib/enterprise/aws-iam-dry-run";
import { isAwsPolicyApproved, validateAwsIamPolicy } from "../lib/enterprise/aws-policy-validator";

test("AWS IAM policy passes HOARE validation when scoped and non-escalating", () => {
  const plan = compileAwsIamDryRun({
    provider: "aws",
    roleBoundary: "tenant-agent",
    credentialStrategy: "temporary",
    permissions: ["translation.invoke", "storage.read-scoped"],
    forbidden: ["iam.*", "admin.*", "long-lived-credentials"],
  });

  const result = validateAwsIamPolicy(plan);
  assert.equal(result.status, "pass");
  assert.equal(isAwsPolicyApproved(result), true);
});

test("AWS IAM policy fails on wildcard or privilege-escalating actions", () => {
  const unsafe = compileAwsIamDryRun({
    provider: "aws",
    roleBoundary: "tenant-agent",
    credentialStrategy: "temporary",
    permissions: ["model.invoke"],
    forbidden: ["iam.*", "admin.*", "long-lived-credentials"],
  });
  unsafe.statements[0]!.Action.push("iam:PassRole");

  const result = validateAwsIamPolicy(unsafe);
  assert.equal(result.status, "fail");
  assert.equal(isAwsPolicyApproved(result), false);
  assert.ok(result.reasons.includes("policy:noForbiddenActions"));
});

test("AWS IAM policy fails on unrestricted resources", () => {
  const unsafe = compileAwsIamDryRun({
    provider: "aws",
    roleBoundary: "tenant-agent",
    credentialStrategy: "temporary",
    permissions: ["model.invoke"],
    forbidden: ["iam.*", "admin.*", "long-lived-credentials"],
  });
  unsafe.statements[0]!.Resource = ["*"];

  const result = validateAwsIamPolicy(unsafe);
  assert.equal(result.status, "fail");
  assert.ok(result.reasons.includes("policy:scopedResources"));
});
