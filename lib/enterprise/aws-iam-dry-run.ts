import type { HoareIamPlan } from "./hoare-builder-planner";

export interface AwsIamStatement {
  Effect: "Allow" | "Deny";
  Action: string[];
  Resource: string[];
}

export interface AwsIamDryRunPlan {
  provider: "aws";
  mode: "dry-run";
  roleNamePattern: "hoare-tenant-agent-*";
  statements: AwsIamStatement[];
  explicitDenials: string[];
  mutationAllowed: false;
}

export function compileAwsIamDryRun(iam: HoareIamPlan): AwsIamDryRunPlan {
  if (iam.provider !== "aws") {
    throw new Error("AWS adapter received a non-AWS IAM plan");
  }

  const allowed: AwsIamStatement = {
    Effect: "Allow",
    Action: iam.permissions.map((permission) => {
      if (permission === "model.invoke") return "bedrock:InvokeModel";
      if (permission === "translation.invoke") return "translate:TranslateText";
      if (permission === "storage.read-scoped") return "s3:GetObject";
      if (permission === "storage.write-scoped") return "s3:PutObject";
      return permission;
    }),
    Resource: ["arn:aws:s3:::HOARE_TENANT_SCOPED_RESOURCE/*"],
  };

  return {
    provider: "aws",
    mode: "dry-run",
    roleNamePattern: "hoare-tenant-agent-*",
    statements: [allowed],
    explicitDenials: ["iam:*", "iam:PassRole", "sts:CreateAccessKey", "long-lived-credentials", ...iam.forbidden],
    mutationAllowed: false,
  };
}

export function isSafeAwsIamDryRun(plan: AwsIamDryRunPlan): boolean {
  return (
    plan.mode === "dry-run" &&
    plan.mutationAllowed === false &&
    plan.roleNamePattern === "hoare-tenant-agent-*" &&
    plan.explicitDenials.includes("iam:*") &&
    plan.explicitDenials.includes("iam:PassRole") &&
    plan.explicitDenials.includes("sts:CreateAccessKey") &&
    plan.explicitDenials.includes("long-lived-credentials") &&
    !plan.statements.some((statement) =>
      statement.Action.some((action) => action === "iam:*" || action === "iam:PassRole"),
    )
  );
}
