import type { BuilderPlan, BuilderResourceKind } from "./types";

export type BuilderPolicy = {
  allowedProviders?: string[];
  allowedEnvironments?: BuilderPlan["deployment"]["environment"][];
  deniedResourceKinds?: BuilderResourceKind[];
  requireApprovalForProduction?: boolean;
};

export function evaluateBuilderPolicy(
  plan: BuilderPlan,
  policy: BuilderPolicy = {},
): string[] {
  const violations: string[] = [];

  if (policy.allowedProviders && !policy.allowedProviders.includes(plan.deployment.provider)) {
    violations.push(`provider ${plan.deployment.provider} is not allowed`);
  }

  if (policy.allowedEnvironments && !policy.allowedEnvironments.includes(plan.deployment.environment)) {
    violations.push(`environment ${plan.deployment.environment} is not allowed`);
  }

  for (const resource of plan.resources) {
    if (policy.deniedResourceKinds?.includes(resource.kind)) {
      violations.push(`resource kind ${resource.kind} is denied`);
    }
  }

  if (policy.requireApprovalForProduction && plan.deployment.environment === "production" && plan.status !== "approved" && plan.status !== "building" && plan.status !== "ready") {
    violations.push("production plans require explicit approval");
  }

  return violations;
}
