export const ALERT_CHANNELS = ["slack", "pagerduty", "email"] as const;

export type AlertChannel = (typeof ALERT_CHANNELS)[number];

export type AlertEvent = {
  tenantId: string;
  type:
    | "runtime-failure"
    | "compliance-violation"
    | "deployment-failure"
    | "ai-provider-outage"
    | "infrastructure-degradation";
  severity: "low" | "medium" | "high" | "critical";
  message: string;
  metadata?: Record<string, unknown>;
};

export type AlertDispatch = {
  channel: AlertChannel;
  delivered: boolean;
  timestamp: string;
};

export class AlertManager {
  private readonly tenantChannels = new Map<string, AlertChannel[]>();

  configureTenant(tenantId: string, channels: AlertChannel[]): void {
    this.tenantChannels.set(tenantId, channels);
  }

  getTenantChannels(tenantId: string): AlertChannel[] {
    return this.tenantChannels.get(tenantId) ?? ["email"];
  }

  dispatch(event: AlertEvent): AlertDispatch[] {
    const channels = this.getTenantChannels(event.tenantId);
    const timestamp = new Date().toISOString();
    return channels.map((channel) => ({ channel, delivered: true, timestamp }));
  }
}

export const alertManager = new AlertManager();
