import { createHash } from "node:crypto";

export interface TenantMeteringEvent {
  eventId: string;
  tenantId: string;
  projectId: string;
  targetId: string;
  environment: "development" | "staging" | "production";
  unitId: string;
  commandId: string;
  actionId: string;
  outcome: "RECOVERED" | "EXECUTED";
  billable: true;
  quantity: number;
  occurredAt: string;
  provenanceHash: string;
}

export interface TenantMeterSink {
  record(event: TenantMeteringEvent): Promise<void>;
}

export function createTenantMeteringEvent(input: Omit<TenantMeteringEvent, "eventId" | "billable">): TenantMeteringEvent {
  if (input.quantity <= 0) throw new Error("METER_QUANTITY_INVALID");
  const eventId = createHash("sha256")
    .update(JSON.stringify(input))
    .digest("hex");
  return { ...input, eventId, billable: true };
}

export class IdempotentTenantMeter implements TenantMeterSink {
  private readonly seen = new Set<string>();

  constructor(private readonly sink: TenantMeterSink) {}

  async record(event: TenantMeteringEvent): Promise<void> {
    if (this.seen.has(event.eventId)) return;
    this.seen.add(event.eventId);
    await this.sink.record(event);
  }
}
