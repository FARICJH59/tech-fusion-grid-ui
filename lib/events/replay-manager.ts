import type { AutonomousEvent, EventReplayRequest } from "@/lib/events/event-types";
import { autonomousEventBus } from "@/lib/events/event-bus";

export class ReplayManager {
  constructor(private readonly bus = autonomousEventBus) {}

  async replayForTenant(request: EventReplayRequest): Promise<AutonomousEvent[]> {
    return this.bus.replay({
      ...request,
      limit: request.limit ?? 250,
    });
  }

  async replayRecent(tenantId: string, organizationId: string, limit = 25): Promise<AutonomousEvent[]> {
    return this.bus.replay({
      tenantId,
      organizationId,
      limit,
    });
  }
}

export const replayManager = new ReplayManager();
