import type { CloudActionEvent, RollbackRequest } from "@/lib/cloud/cloud-types";
import type { GcpCloudClient } from "@/lib/cloud/gcp-client";
import { assertTcxExecutionAuthority } from "@/lib/hoare/runtime/governed-execution-authority";
import { cloudActionEventBus } from "@/lib/cloud/action-events";
import { recordRollback } from "@/lib/telemetry/autonomous-observability";

export type RollbackResult = { request: RollbackRequest; success: boolean; verificationPassed: boolean; event: CloudActionEvent };

export class RollbackEngine {
  private readonly audit: CloudActionEvent[] = [];
  constructor(private readonly cloudClient: Pick<GcpCloudClient, "updateTraffic" | "verifyHealth">) {}

  async execute(request: RollbackRequest): Promise<RollbackResult> {
    const authority = request.authority;
    if (!authority) throw new Error("tcx_authority_required_for_live_rollback");
    assertTcxExecutionAuthority(authority);
    if (authority.tenantId !== request.tenantId) throw new Error("tcx_authority_tenant_mismatch");

    // Revalidate immediately before the injected mutation boundary as defense in depth.
    await authority.assertValid();
    const status = await this.cloudClient.updateTraffic(request.service, request.region, [
      { revision: request.toRevision, percent: 100 },
      { revision: request.fromRevision, percent: 0 },
    ], authority);
    const health = await this.cloudClient.verifyHealth(request.service);
    const event: CloudActionEvent = {
      id: `${request.tenantId}:${request.service}:rollback:${Date.now().toString(36)}`,
      tenantId: request.tenantId, actionType: "rollback", resource: request.service,
      requestedBy: "rollback-engine", reason: request.reason, riskLevel: "high",
      previousState: { revision: request.fromRevision }, newState: { revision: request.toRevision, traffic: status.traffic },
      approvalStatus: "approved", executionStatus: health.healthy ? "completed" : "failed", timestamp: new Date().toISOString(),
    };
    this.audit.push(event);
    recordRollback("rollback-engine");
    await cloudActionEventBus.publish(event);
    return { request, success: true, verificationPassed: health.healthy, event };
  }

  listAudit(): CloudActionEvent[] { return [...this.audit]; }
}
