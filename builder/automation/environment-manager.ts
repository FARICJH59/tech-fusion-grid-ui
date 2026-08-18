export type HoareEnvironment = "development" | "staging" | "production";

export interface EnvironmentPolicy {
  environment: HoareEnvironment;
  autonomous: boolean;
  approvalRequiredActions: readonly string[];
  destructiveActions: readonly string[];
}

export interface EnvironmentDecision {
  allowed: boolean;
  requiresApproval: boolean;
  reason: string;
}

export class EnvironmentManager {
  constructor(private readonly policies: readonly EnvironmentPolicy[]) {}

  evaluate(environment: HoareEnvironment, action: string): EnvironmentDecision {
    const policy = this.policies.find((candidate) => candidate.environment === environment);
    if (!policy) return { allowed: false, requiresApproval: false, reason: "ENVIRONMENT_POLICY_MISSING" };
    if (policy.destructiveActions.includes(action)) {
      return { allowed: false, requiresApproval: true, reason: "DESTRUCTIVE_ACTION_REQUIRES_AUTHORIZATION" };
    }
    if (policy.approvalRequiredActions.includes(action)) {
      return { allowed: true, requiresApproval: true, reason: "ENVIRONMENT_APPROVAL_REQUIRED" };
    }
    if (!policy.autonomous) {
      return { allowed: true, requiresApproval: true, reason: "ENVIRONMENT_NOT_AUTONOMOUS" };
    }
    return { allowed: true, requiresApproval: false, reason: "ENVIRONMENT_AUTONOMOUS" };
  }
}
