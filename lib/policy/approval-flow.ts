import type { ApprovalStatus } from "@/lib/cloud/cloud-types";

export type ApprovalRecord = {
  id: string;
  tenantId: string;
  actionId: string;
  status: ApprovalStatus;
  approver?: string;
  reason?: string;
  createdAt: string;
  updatedAt: string;
};

export class ApprovalFlow {
  private readonly approvals = new Map<string, ApprovalRecord>();

  create(tenantId: string, actionId: string, status: ApprovalStatus): ApprovalRecord {
    const now = new Date().toISOString();
    const record: ApprovalRecord = {
      id: `${tenantId}:${actionId}`,
      tenantId,
      actionId,
      status,
      createdAt: now,
      updatedAt: now,
    };
    this.approvals.set(record.id, record);
    return record;
  }

  update(
    id: string,
    status: ApprovalStatus,
    approver?: string,
    reason?: string,
  ): ApprovalRecord | null {
    const current = this.approvals.get(id);
    if (!current) return null;
    const updated: ApprovalRecord = {
      ...current,
      status,
      approver: approver ?? current.approver,
      reason: reason ?? current.reason,
      updatedAt: new Date().toISOString(),
    };
    this.approvals.set(id, updated);
    return updated;
  }

  get(id: string): ApprovalRecord | null {
    return this.approvals.get(id) ?? null;
  }

  list(): ApprovalRecord[] {
    return [...this.approvals.values()];
  }
}
