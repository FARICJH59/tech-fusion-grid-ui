import type { AgentExecutionContext } from "./context";

export type AgentRole = "viewer" | "operator" | "admin" | "service";
export type TenantScopePolicy = "current-tenant" | "organization" | "cross-tenant";
export type PermissionEffect = "allow" | "deny" | "require-approval";

export type AgentPermission = {
  id: string;
  resource: string;
  action: string;
  description: string;
  requiredRole: AgentRole;
  tenantScope: TenantScopePolicy;
  securityPolicies: string[];
  auditRequired: boolean;
  approvalRequired?: boolean;
  attributes?: Record<string, string>;
  riskLevel?: "low" | "medium" | "high" | "critical";
};

export type AgentAuditEntry = {
  permissionId: string;
  agentId?: string;
  actorId: string;
  action: string;
  effect: PermissionEffect;
  tenantId: string;
  timestamp: string;
  reason: string;
};

export type PermissionEvaluationRequest = {
  permission: AgentPermission;
  context: AgentExecutionContext;
  resourceTenantId?: string;
  agentId?: string;
};

export type PermissionEvaluationResult = {
  allowed: boolean;
  approvalRequired: boolean;
  effect: PermissionEffect;
  reason: string;
  auditEntry?: AgentAuditEntry;
};

export type PermissionPolicyDecision = {
  allowed: boolean;
  approvalRequired?: boolean;
  reason?: string;
};

export type AgentPermissionEvaluatorOptions = {
  authorize?: (request: PermissionEvaluationRequest) => boolean | Promise<boolean>;
  evaluatePolicy?: (
    request: PermissionEvaluationRequest,
  ) => PermissionPolicyDecision | Promise<PermissionPolicyDecision>;
  audit?: (entry: AgentAuditEntry) => void | Promise<void>;
};

export class AgentPermissionEvaluator {
  constructor(private readonly options: AgentPermissionEvaluatorOptions = {}) {}

  async evaluate(request: PermissionEvaluationRequest): Promise<PermissionEvaluationResult> {
    const resourceTenantId = request.resourceTenantId ?? request.context.tenant.tenantId;
    const tenantAllowed =
      request.permission.tenantScope === "cross-tenant" ||
      request.context.tenant.tenantId === resourceTenantId;

    if (!tenantAllowed) {
      const auditEntry = this.createAuditEntry(request, "deny", "Tenant isolation policy denied access.");
      await this.writeAudit(auditEntry, request.permission.auditRequired);
      return {
        allowed: false,
        approvalRequired: false,
        effect: "deny",
        reason: auditEntry.reason,
        auditEntry,
      };
    }

    const authorized = this.options.authorize ? await this.options.authorize(request) : true;
    if (!authorized) {
      const auditEntry = this.createAuditEntry(request, "deny", "RBAC or ABAC authorization failed.");
      await this.writeAudit(auditEntry, request.permission.auditRequired);
      return {
        allowed: false,
        approvalRequired: false,
        effect: "deny",
        reason: auditEntry.reason,
        auditEntry,
      };
    }

    const policyDecision = this.options.evaluatePolicy
      ? await this.options.evaluatePolicy(request)
      : { allowed: true, approvalRequired: false, reason: "Approved by default agent policy." };

    if (!policyDecision.allowed) {
      const auditEntry = this.createAuditEntry(
        request,
        "deny",
        policyDecision.reason ?? "Policy engine rejected the action.",
      );
      await this.writeAudit(auditEntry, request.permission.auditRequired);
      return {
        allowed: false,
        approvalRequired: false,
        effect: "deny",
        reason: auditEntry.reason,
        auditEntry,
      };
    }

    const approvalRequired = Boolean(policyDecision.approvalRequired || request.permission.approvalRequired);
    const effect: PermissionEffect = approvalRequired ? "require-approval" : "allow";
    const auditEntry = this.createAuditEntry(
      request,
      effect,
      policyDecision.reason ?? (approvalRequired ? "Manual approval required." : "Permission granted."),
    );
    await this.writeAudit(auditEntry, request.permission.auditRequired);

    return {
      allowed: !approvalRequired,
      approvalRequired,
      effect,
      reason: auditEntry.reason,
      auditEntry,
    };
  }

  private createAuditEntry(
    request: PermissionEvaluationRequest,
    effect: PermissionEffect,
    reason: string,
  ): AgentAuditEntry {
    return {
      permissionId: request.permission.id,
      agentId: request.agentId,
      actorId: request.context.actor.id,
      action: request.permission.action,
      effect,
      tenantId: request.context.tenant.tenantId,
      timestamp: new Date().toISOString(),
      reason,
    };
  }

  private async writeAudit(entry: AgentAuditEntry, auditRequired: boolean): Promise<void> {
    if (auditRequired && this.options.audit) {
      await this.options.audit(entry);
    }
  }
}
