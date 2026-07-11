import type { CloudActionEvent, RollbackRequest } from "@/lib/cloud/cloud-types";
import type { GcpCloudClient } from "@/lib/cloud/gcp-client";

export type RollbackResult = {
  request: RollbackRequest;
  success: boolean;
  verificationPassed: boolean;
  event: CloudActionEvent;
};

export class RollbackEngine {
  private readonly audit: CloudActionEvent[] = [];

  constructor(private readonly cloudClient: Pick<GcpCloudClient, "updateTraffic" | "verifyHealth">) {}

  async execute(request: RollbackRequest): Promise<RollbackResult> {
    const status = await this.cloudClient.updateTraffic(request.service, request.region, [
      { revision: request.toRevision, percent: 100 },
      { revision: request.fromRevision, percent: 0 },
    ]);
    const health = await this.cloudClient.verifyHealth(request.service);

    const event: CloudActionEvent = {
      id: `${request.tenantId}:${request.service}:rollback:${Date.now().toString(36)}`,
      tenantId: request.tenantId,
      actionType: "rollback",
      resource: request.service,
      requestedBy: "rollback-engine",
      reason: request.reason,
      riskLevel: "high",
      previousState: { revision: request.fromRevision },
      newState: { revision: request.toRevision, traffic: status.traffic },
      approvalStatus: "approved",
      executionStatus: health.healthy ? "completed" : "failed",
      timestamp: new Date().toISOString(),
    };

    this.audit.push(event);

    return {
      request,
      success: true,
      verificationPassed: health.healthy,
      event,
    };
  }

  listAudit(): CloudActionEvent[] {
    return [...this.audit];
  }
}
