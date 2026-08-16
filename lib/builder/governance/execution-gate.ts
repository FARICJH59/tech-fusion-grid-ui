export type ExecutionPrincipal = {
  id: string;
  roles: string[];
};

export type ExecutionEntitlement = {
  tenantId: string;
  active: boolean;
  capabilities: string[];
  quotaRemaining: number;
};

export type ExecutionGateRequest = {
  principal: ExecutionPrincipal;
  entitlement: ExecutionEntitlement;
  action: string;
  quotaCost: number;
};

export type ExecutionGateDecision = {
  allowed: boolean;
  reason: "ALLOW" | "IAM_DENIED" | "TENANT_INACTIVE" | "CAPABILITY_DENIED" | "QUOTA_DENIED";
};

/** Final admission gate immediately before runtime execution. */
export function authorizeExecution(request: ExecutionGateRequest): ExecutionGateDecision {
  if (!request.entitlement.active) return { allowed: false, reason: "TENANT_INACTIVE" };

  const privileged = request.principal.roles.includes("admin") || request.principal.roles.includes("operator");
  if (!privileged) return { allowed: false, reason: "IAM_DENIED" };

  if (!request.entitlement.capabilities.includes(request.action)) {
    return { allowed: false, reason: "CAPABILITY_DENIED" };
  }

  if (request.quotaCost > request.entitlement.quotaRemaining) {
    return { allowed: false, reason: "QUOTA_DENIED" };
  }

  return { allowed: true, reason: "ALLOW" };
}
