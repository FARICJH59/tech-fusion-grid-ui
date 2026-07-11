import type { ApprovalStatus, CloudActionEvent, ExecutionStatus } from "@/lib/cloud/cloud-types";
import { ApprovalFlow } from "@/lib/policy/approval-flow";
import { DEFAULT_POLICY_RULES, type PolicyRule } from "@/lib/policy/rules";
import { compareRisk, scoreActionRisk } from "@/lib/policy/risk-scoring";

export type PolicyDecision = {
  actionId: string;
  approved: boolean;
  decision: "approve" | "reject" | "escalate";
  approvalStatus: ApprovalStatus;
  executionStatus: ExecutionStatus;
  reason: string;
  appliedRule: PolicyRule;
};

export class AutonomousPolicyEngine {
  private readonly rules: PolicyRule[];
  readonly approvals: ApprovalFlow;
  private readonly decisions: PolicyDecision[] = [];

  constructor(rules: PolicyRule[] = DEFAULT_POLICY_RULES, approvals = new ApprovalFlow()) {
    this.rules = rules;
    this.approvals = approvals;
  }

  evaluate(event: CloudActionEvent): PolicyDecision {
    const rule = this.rules.find((candidate) => candidate.action === event.actionType);
    if (!rule) {
      return {
        actionId: event.id,
        approved: false,
        decision: "reject",
        approvalStatus: "rejected",
        executionStatus: "failed",
        reason: `No policy rule exists for action ${event.actionType}`,
        appliedRule: {
          id: "missing-rule",
          version: 0,
          action: event.actionType,
          maxRiskLevel: "low",
          allowAutoApprove: false,
          budgetGuardEnabled: true,
          requireTenantIsolation: true,
        },
      };
    }

    const risk = scoreActionRisk({ riskLevel: event.riskLevel, reason: event.reason });
    const withinRisk = compareRisk(risk.level, rule.maxRiskLevel) <= 0;
    const hasIsolation = Boolean(event.tenantId);
    const exceedsBudget =
      rule.budgetGuardEnabled &&
      typeof event.newState.projectedCostUsd === "number" &&
      typeof event.newState.budgetLimitUsd === "number" &&
      (event.newState.projectedCostUsd as number) > (event.newState.budgetLimitUsd as number);

    let decision: PolicyDecision;
    if (!withinRisk || !hasIsolation || exceedsBudget) {
      decision = {
        actionId: event.id,
        approved: false,
        decision: "reject",
        approvalStatus: "rejected",
        executionStatus: "failed",
        reason: !withinRisk
          ? `Risk level ${risk.level} exceeds allowed maximum ${rule.maxRiskLevel}`
          : exceedsBudget
            ? "Projected cost exceeds budget policy limits"
            : "Tenant isolation requirement failed",
        appliedRule: rule,
      };
    } else if (!rule.allowAutoApprove) {
      this.approvals.create(event.tenantId, event.id, "pending");
      decision = {
        actionId: event.id,
        approved: false,
        decision: "escalate",
        approvalStatus: "pending",
        executionStatus: "approved",
        reason: "Manual approval required by policy",
        appliedRule: rule,
      };
    } else {
      this.approvals.create(event.tenantId, event.id, "approved");
      decision = {
        actionId: event.id,
        approved: true,
        decision: "approve",
        approvalStatus: "approved",
        executionStatus: "approved",
        reason: "Auto-approved by policy",
        appliedRule: rule,
      };
    }

    this.decisions.push(decision);
    return decision;
  }

  listDecisions(): PolicyDecision[] {
    return [...this.decisions];
  }

  listRules(): PolicyRule[] {
    return [...this.rules];
  }
}

export const autonomousPolicyEngine = new AutonomousPolicyEngine();
