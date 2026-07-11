import type { Role } from "@/lib/auth";
import { EnterpriseSecurity } from "@/lib/enterprise/security";
import { autonomousPolicyEngine, type PolicyDecision } from "@/lib/policy/engine";
import { ApprovalFlow } from "@/lib/policy/approval-flow";
import { operatorActionQueue } from "@/lib/policy/operator-actions";
import type { CloudActionType, RiskLevel } from "@/lib/cloud/cloud-types";
import type { AgentExecutionContext } from "../../packages/agent-sdk/src/context";
import { AGENT_RUNTIME_EVENT_NAMES, AgentRuntimeEventBus } from "../runtime/agent-events";
import { runtimeStateStore } from "@/lib/enterprise/runtime-state";

const CLOUD_ACTIONS = new Set<CloudActionType>([
  "deploy",
  "revision-update",
  "traffic-migration",
  "rollback",
  "scale",
  "health-verify",
  "remediation",
]);

export type AgentSecurityAuditEvent = {
  agentId: string;
  tenantId: string;
  action: string;
  resource: string;
  decision: "allow" | "deny" | "require-approval";
  timestamp: string;
  reason: string;
};

export type AgentAuthorizationRequest = {
  agentId: string;
  tenantId: string;
  action: string;
  resource: string;
  context: AgentExecutionContext;
  requiredRole?: Role;
  attributes?: Record<string, string>;
  riskLevel?: RiskLevel;
  approvalRequired?: boolean;
  budgetLimitUsd?: number;
  projectedCostUsd?: number;
};

export type AgentAuthorizationResult = {
  allowed: boolean;
  approvalRequired: boolean;
  reason: string;
  auditEvent: AgentSecurityAuditEvent;
  policyDecision?: PolicyDecision;
};

export class AgentSecurityRuntime {
  private readonly auditTrail: AgentSecurityAuditEvent[] = [];

  constructor(
    private readonly security = new EnterpriseSecurity(),
    private readonly approvals = new ApprovalFlow(),
    private readonly events = new AgentRuntimeEventBus(),
  ) {}

  async authorize(request: AgentAuthorizationRequest): Promise<AgentAuthorizationResult> {
    const timestamp = new Date().toISOString();

    if (request.context.tenant.tenantId !== request.tenantId) {
      return this.finish({
        agentId: request.agentId,
        tenantId: request.tenantId,
        action: request.action,
        resource: request.resource,
        decision: "deny",
        timestamp,
        reason: "Tenant boundary violation.",
      });
    }

    const authorized = this.security.isAuthorized({
      role: request.context.actor.role as Role,
      requiredRole: request.requiredRole ?? "viewer",
      tenantId: request.context.tenant.tenantId,
      resourceTenantId: request.tenantId,
      attributes: request.attributes,
    });

    if (!authorized) {
      return this.finish({
        agentId: request.agentId,
        tenantId: request.tenantId,
        action: request.action,
        resource: request.resource,
        decision: "deny",
        timestamp,
        reason: "RBAC/ABAC authorization failed.",
      });
    }

    let policyDecision: PolicyDecision | undefined;
    let approvalRequired = Boolean(request.approvalRequired);
    let reason = "Authorized by AgentFusion security runtime.";

    if (CLOUD_ACTIONS.has(request.action as CloudActionType)) {
      policyDecision = autonomousPolicyEngine.evaluate({
        id: `${request.agentId}:${request.context.requestId}:${request.action}`,
        tenantId: request.tenantId,
        actionType: request.action as CloudActionType,
        resource: request.resource,
        requestedBy: request.context.actor.id,
        reason: `AgentFusion action ${request.action}`,
        riskLevel: request.riskLevel ?? "low",
        previousState: {},
        newState: {
          budgetLimitUsd: request.budgetLimitUsd ?? request.context.budget?.maxCostUsd ?? 0,
          projectedCostUsd: request.projectedCostUsd ?? 0,
        },
        approvalStatus: "not-required",
        executionStatus: "requested",
        timestamp,
      });

      approvalRequired = policyDecision.decision === "escalate";
      if (policyDecision.decision === "reject") {
        return this.finish({
          agentId: request.agentId,
          tenantId: request.tenantId,
          action: request.action,
          resource: request.resource,
          decision: "deny",
          timestamp,
          reason: policyDecision.reason,
        }, policyDecision);
      }

      reason = policyDecision.reason;
    }

    if (approvalRequired) {
      this.approvals.create(request.tenantId, `${request.agentId}:${request.context.requestId}:${request.action}`, "pending");
      operatorActionQueue.enqueue({
        id: `${request.agentId}:${request.context.requestId}:${request.action}`,
        tenantId: request.tenantId,
        organizationId: request.context.tenant.organizationId ?? request.tenantId,
        resource: request.resource,
        requestedAction: request.action,
        impact: reason,
        riskLevel: request.riskLevel ?? "medium",
        aiRecommendation: `Approval required for ${request.agentId}`,
        approvalStatus: "pending",
        requestedBy: request.context.actor.id,
      });

      const result = this.finish({
        agentId: request.agentId,
        tenantId: request.tenantId,
        action: request.action,
        resource: request.resource,
        decision: "require-approval",
        timestamp,
        reason,
      }, policyDecision);

      await this.events.emit(AGENT_RUNTIME_EVENT_NAMES.AgentApprovalRequired, {
        agentId: request.agentId,
        tenantId: request.tenantId,
        correlationId: request.context.correlationId,
        payload: {
          action: request.action,
          resource: request.resource,
          reason,
        },
      });

      return result;
    }

    return this.finish({
      agentId: request.agentId,
      tenantId: request.tenantId,
      action: request.action,
      resource: request.resource,
      decision: "allow",
      timestamp,
      reason,
    }, policyDecision);
  }

  listAudit(tenantId?: string): AgentSecurityAuditEvent[] {
    return tenantId ? this.auditTrail.filter((entry) => entry.tenantId === tenantId) : [...this.auditTrail];
  }

  private finish(auditEvent: AgentSecurityAuditEvent, policyDecision?: PolicyDecision): AgentAuthorizationResult {
    this.auditTrail.unshift(auditEvent);
    void this.persistAudit(auditEvent);
    return {
      allowed: auditEvent.decision === "allow",
      approvalRequired: auditEvent.decision === "require-approval",
      reason: auditEvent.reason,
      auditEvent,
      policyDecision,
    };
  }

  private async persistAudit(event: AgentSecurityAuditEvent): Promise<void> {
    try {
      await runtimeStateStore.save("workflows", {
        id: `agentfusion-audit:${event.agentId}:${event.timestamp}`,
        tenant_id: event.tenantId,
        payload: {
          kind: "agentfusion-security-audit",
          ...event,
        },
      });
    } catch {
      // Best-effort persistence.
    }
  }
}
