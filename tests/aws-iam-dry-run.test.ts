import assert from "node:assert/strict";
import test from "node:test";

import { compileAwsIamDryRun, isSafeAwsIamDryRun } from "../lib/enterprise/aws-iam-dry-run";

test("AWS IAM adapter compiles HOARE intent into a constrained dry-run", () => {
  const plan = compileAwsIamDryRun({
    provider: "aws",
    roleBoundary: "tenant-agent",
    credentialStrategy: "temporary",
    permissions: ["translation.invoke", "storage.read-scoped"],
    forbidden: ["iam.*", "admin.*", "long-lived-credentials"],
  });

  assert.equal(plan.mode, "dry-run");
  assert.equal(plan.mutationAllowed, false);
  assert.equal(plan.roleNamePattern, "hoare-tenant-agent-*");
  assert.ok(plan.statements[0]?.Action.includes("translate:TranslateText"));
  assert.ok(plan.statements[0]?.Action.includes("s3:GetObject"));
  assert.ok(plan.explicitDenials.includes("iam:PassRole"));
  assert.ok(plan.explicitDenials.includes("sts:CreateAccessKey"));
  assert.equal(isSafeAwsIamDryRun(plan), true);
});

test("AWS IAM dry-run rejects privilege escalation", () => {
  const unsafe = {
    provider: "aws" as const,
    mode: "dry-run" as const,
    roleNamePattern: "hoare-tenant-agent-*" as const,
    statements: [
      {
        Effect: "Allow" as const,
        Action: ["iam:PassRole"],
        Resource: ["*"],
      },
    ],
    explicitDenials: ["iam:*", "iam:PassRole", "sts:CreateAccessKey", "long-lived-credentials"],
    mutationAllowed: false as const,
  };

  assert.equal(isSafeAwsIamDryRun(unsafe), false);
});
