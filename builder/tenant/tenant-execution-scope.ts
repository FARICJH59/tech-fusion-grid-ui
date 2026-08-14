import { createHash } from "node:crypto";

export type TenantEnvironment = "development" | "staging" | "production";

export interface TenantExecutionScope {
  tenantId: string;
  projectId: string;
  targetId: string;
  environment: TenantEnvironment;
  resourceId: string;
  provider: string;
  policyVersion: string;
  authorizedActions: readonly string[];
}

export interface TenantScopeDecision {
  allowed: boolean;
  reason: string;
  scopeHash: string;
}

export function evaluateTenantExecutionScope(
  scope: TenantExecutionScope,
  requestedAction: string,
): TenantScopeDecision {
  const scopeHash = createHash("sha256").update(JSON.stringify(scope)).digest("hex");

  if (!scope.tenantId || !scope.projectId || !scope.targetId || !scope.resourceId) {
    return { allowed: false, reason: "TENANT_SCOPE_INCOMPLETE", scopeHash };
  }
  if (!scope.policyVersion) {
    return { allowed: false, reason: "TENANT_POLICY_REQUIRED", scopeHash };
  }
  if (!scope.authorizedActions.includes(requestedAction)) {
    return { allowed: false, reason: "TENANT_ACTION_NOT_AUTHORIZED", scopeHash };
  }

  return { allowed: true, reason: "TENANT_SCOPE_AUTHORIZED", scopeHash };
}
