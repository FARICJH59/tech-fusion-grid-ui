export type ApprovalDelegationRule = {
  tenantId: string;
  organizationId: string;
  approverId: string;
  delegateId: string;
  reason: string;
  validUntil: string;
};

export class ApprovalDelegationRegistry {
  private readonly rules = new Map<string, ApprovalDelegationRule>();

  set(rule: ApprovalDelegationRule): void {
    this.rules.set(this.key(rule.tenantId, rule.organizationId, rule.approverId), rule);
  }

  resolve(input: {
    tenantId: string;
    organizationId: string;
    approverId: string;
    now?: string;
  }): { effectiveApproverId: string; delegated: boolean } {
    const rule = this.rules.get(this.key(input.tenantId, input.organizationId, input.approverId));
    if (!rule) return { effectiveApproverId: input.approverId, delegated: false };

    const now = Date.parse(input.now ?? new Date().toISOString());
    if (Number.isNaN(now) || now > Date.parse(rule.validUntil)) {
      return { effectiveApproverId: input.approverId, delegated: false };
    }

    return { effectiveApproverId: rule.delegateId, delegated: true };
  }

  private key(tenantId: string, organizationId: string, approverId: string): string {
    return `${tenantId}:${organizationId}:${approverId}`;
  }
}

export const approvalDelegationRegistry = new ApprovalDelegationRegistry();
