import type { CloudActionEvent } from "@/lib/cloud/cloud-types";
import { redis } from "@/lib/redis";
import { supabase } from "@/lib/supabase";
import { autonomousEventBus } from "@/lib/events/event-bus";

export class CloudActionEventBus {
  constructor(private readonly streamName = "cloud-action-events") {}

  async publish(event: CloudActionEvent): Promise<void> {
    await autonomousEventBus.publish({
      id: event.id,
      tenantId: event.tenantId,
      organizationId: event.tenantId,
      type: "cloud-action",
      source: "cloud-action-event-bus",
      priority: event.riskLevel === "critical" ? "critical" : event.riskLevel === "high" ? "high" : "medium",
      timestamp: event.timestamp,
      payload: event as unknown as Record<string, unknown>,
      dedupeKey: `cloud-action:${event.id}`,
    });

    if (process.env.REDIS_URL) {
      await redis
        .xadd(this.streamName, "*", "event", JSON.stringify(event))
        .catch(() => undefined);
    }

    try {
      await supabase.from("cloud_actions").insert({
        id: event.id,
        tenant_id: event.tenantId,
        organization_id: event.tenantId,
        action_type: event.actionType,
        resource: event.resource,
        impact: event.reason,
        risk_level: event.riskLevel,
        ai_recommendation: event.reason,
        approval_status: event.approvalStatus,
        execution_status: event.executionStatus,
        metadata: event,
        created_at: event.timestamp,
      });
    } catch {
      // Best-effort persistence in non-configured environments.
    }
  }
}

export const cloudActionEventBus = new CloudActionEventBus();
