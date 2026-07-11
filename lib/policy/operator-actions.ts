import type { ApprovalStatus, RiskLevel } from "@/lib/cloud/cloud-types";
import { autonomousEventBus } from "@/lib/events/event-bus";
import { approvalDelegationRegistry } from "@/lib/policy/approval-delegation";
import { emergencyControls } from "@/lib/policy/emergency-controls";

export type OperatorActionRequest = {
  id: string;
  tenantId: string;
  organizationId: string;
  resource: string;
  requestedAction: string;
  impact: string;
  riskLevel: RiskLevel;
  aiRecommendation: string;
  approvalStatus: ApprovalStatus;
  requestedBy: string;
  createdAt: string;
  updatedAt: string;
};

export type OperatorAuditEvent = {
  requestId: string;
  tenantId: string;
  organizationId: string;
  operatorId: string;
  action: "approve" | "reject" | "modify" | "emergency-stop";
  reason: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
};

export class OperatorActionQueue {
  private readonly queue = new Map<string, OperatorActionRequest>();
  private readonly audit: OperatorAuditEvent[] = [];

  enqueue(request: Omit<OperatorActionRequest, "createdAt" | "updatedAt">): OperatorActionRequest {
    const now = new Date().toISOString();
    const record: OperatorActionRequest = {
      ...request,
      createdAt: now,
      updatedAt: now,
    };

    this.queue.set(record.id, record);
    return record;
  }

  approve(input: {
    requestId: string;
    tenantId: string;
    organizationId: string;
    operatorId: string;
    reason: string;
  }): OperatorActionRequest | null {
    const request = this.queue.get(input.requestId);
    if (!request) return null;

    const delegated = approvalDelegationRegistry.resolve({
      tenantId: input.tenantId,
      organizationId: input.organizationId,
      approverId: input.operatorId,
    });

    request.approvalStatus = "approved";
    request.updatedAt = new Date().toISOString();
    this.queue.set(request.id, request);

    this.appendAudit({
      requestId: request.id,
      tenantId: input.tenantId,
      organizationId: input.organizationId,
      operatorId: delegated.effectiveApproverId,
      action: "approve",
      reason: input.reason,
      metadata: { delegated: delegated.delegated },
    });

    return request;
  }

  reject(input: {
    requestId: string;
    tenantId: string;
    organizationId: string;
    operatorId: string;
    reason: string;
  }): OperatorActionRequest | null {
    const request = this.queue.get(input.requestId);
    if (!request) return null;
    request.approvalStatus = "rejected";
    request.updatedAt = new Date().toISOString();
    this.queue.set(request.id, request);

    this.appendAudit({
      requestId: request.id,
      tenantId: input.tenantId,
      organizationId: input.organizationId,
      operatorId: input.operatorId,
      action: "reject",
      reason: input.reason,
    });

    return request;
  }

  modify(input: {
    requestId: string;
    tenantId: string;
    organizationId: string;
    operatorId: string;
    reason: string;
    patch: Partial<Pick<OperatorActionRequest, "impact" | "requestedAction" | "aiRecommendation" | "riskLevel">>;
  }): OperatorActionRequest | null {
    const request = this.queue.get(input.requestId);
    if (!request) return null;

    const updated: OperatorActionRequest = {
      ...request,
      ...input.patch,
      updatedAt: new Date().toISOString(),
    };
    this.queue.set(updated.id, updated);

    this.appendAudit({
      requestId: updated.id,
      tenantId: input.tenantId,
      organizationId: input.organizationId,
      operatorId: input.operatorId,
      action: "modify",
      reason: input.reason,
      metadata: input.patch,
    });

    return updated;
  }

  emergencyStop(input: {
    requestId: string;
    tenantId: string;
    organizationId: string;
    resource: string;
    operatorId: string;
    reason: string;
  }): OperatorActionRequest | null {
    const request = this.queue.get(input.requestId);
    if (!request) return null;

    emergencyControls.activate({
      tenantId: input.tenantId,
      organizationId: input.organizationId,
      resource: input.resource,
      operatorId: input.operatorId,
      reason: input.reason,
    });

    request.approvalStatus = "escalated";
    request.updatedAt = new Date().toISOString();
    this.queue.set(request.id, request);

    this.appendAudit({
      requestId: request.id,
      tenantId: input.tenantId,
      organizationId: input.organizationId,
      operatorId: input.operatorId,
      action: "emergency-stop",
      reason: input.reason,
      metadata: { resource: input.resource },
    });

    return request;
  }

  list(tenantId?: string): OperatorActionRequest[] {
    const values = [...this.queue.values()];
    return tenantId ? values.filter((item) => item.tenantId === tenantId) : values;
  }

  listAudit(): OperatorAuditEvent[] {
    return [...this.audit];
  }

  private appendAudit(event: Omit<OperatorAuditEvent, "timestamp">): void {
    const timestamp = new Date().toISOString();
    const record: OperatorAuditEvent = { ...event, timestamp };
    this.audit.push(record);

    void autonomousEventBus.publish({
      id: `operator:${event.requestId}:${Date.now().toString(36)}`,
      tenantId: event.tenantId,
      organizationId: event.organizationId,
      type: "operator-override",
      source: "operator-actions",
      priority: event.action === "emergency-stop" ? "critical" : "high",
      timestamp,
      payload: {
        requestId: event.requestId,
        operatorId: event.operatorId,
        action: event.action,
        reason: event.reason,
        metadata: event.metadata ?? {},
      },
    });
  }
}

export const operatorActionQueue = new OperatorActionQueue();
