import type { ApprovalStatus } from "@/lib/cloud/cloud-types";
import { supabase } from "@/lib/supabase";
import { autonomousEventBus } from "@/lib/events/event-bus";

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
    void this.persist(record);
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
    void this.persist(updated, approver, reason);
    return updated;
  }

  get(id: string): ApprovalRecord | null {
    return this.approvals.get(id) ?? null;
  }

  list(): ApprovalRecord[] {
    return [...this.approvals.values()];
  }

  private async persist(record: ApprovalRecord, approver?: string, reason?: string): Promise<void> {
    try {
      await supabase.from("approval_requests").upsert({
        id: record.id,
        tenant_id: record.tenantId,
        organization_id: record.tenantId,
        action_id: record.actionId,
        status: record.status,
        requested_by: "autonomous-policy-engine",
        approved_by: approver,
        reason: reason ?? record.reason,
        metadata: record,
        updated_at: record.updatedAt,
      });
    } catch {
      // Best-effort persistence in non-configured environments.
    }

    await autonomousEventBus.publish({
      id: `approval:${record.id}:${record.updatedAt}`,
      tenantId: record.tenantId,
      organizationId: record.tenantId,
      type: "approval",
      source: "approval-flow",
      priority: record.status === "rejected" ? "high" : "medium",
      timestamp: record.updatedAt,
      payload: {
        actionId: record.actionId,
        status: record.status,
        approver: approver ?? record.approver,
        reason: reason ?? record.reason,
      },
      dedupeKey: `approval:${record.id}:${record.status}:${record.updatedAt}`,
    });
  }
}
