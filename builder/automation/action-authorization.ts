export type ActionRisk = "low" | "medium" | "high" | "critical";
export type AuthorizationDecision = "ALLOW" | "DENY" | "ESCALATE";

export interface ActionAuthorizationRequest {
  tenantId: string;
  projectId: string;
  environment: "development" | "staging" | "production";
  action: string;
  risk: ActionRisk;
  requestedBy: string;
  policy: {
    allowedActions: readonly string[];
    autonomousRisks: readonly ActionRisk[];
    approvalRequiredRisks?: readonly ActionRisk[];
  };
}

export interface ActionAuthorizationResult {
  decision: AuthorizationDecision;
  reason: string;
}

export function authorizeAction(input: ActionAuthorizationRequest): ActionAuthorizationResult {
  if (!input.tenantId || !input.projectId || !input.requestedBy) {
    return { decision: "DENY", reason: "AUTHORIZATION_CONTEXT_INCOMPLETE" };
  }
  if (!input.policy.allowedActions.includes(input.action)) {
    return { decision: "DENY", reason: "ACTION_NOT_ALLOWLISTED" };
  }
  if (input.policy.approvalRequiredRisks?.includes(input.risk)) {
    return { decision: "ESCALATE", reason: "APPROVAL_REQUIRED" };
  }
  if (!input.policy.autonomousRisks.includes(input.risk)) {
    return { decision: "ESCALATE", reason: "RISK_REQUIRES_REVIEW" };
  }
  return { decision: "ALLOW", reason: "ACTION_AUTHORIZED" };
}
