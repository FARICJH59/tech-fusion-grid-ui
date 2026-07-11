import type { CloudActionEvent } from "@/lib/cloud/cloud-types";
import { redis } from "@/lib/redis";
import { supabase } from "@/lib/supabase";

export class CloudActionEventBus {
  constructor(private readonly streamName = "cloud-action-events") {}

  async publish(event: CloudActionEvent): Promise<void> {
    await redis
      .xadd(this.streamName, "*", "event", JSON.stringify(event))
      .catch(() => undefined);

    await supabase
      .from("phase8_cloud_action_events")
      .insert({
        id: event.id,
        tenant_id: event.tenantId,
        action_type: event.actionType,
        resource: event.resource,
        payload: event,
        created_at: event.timestamp,
      })
      .throwOnError()
      .catch(() => undefined);
  }
}

export const cloudActionEventBus = new CloudActionEventBus();
