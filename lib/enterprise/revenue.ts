export const REVENUE_FEATURES = [
  "Usage Metering",
  "Subscription Billing",
  "Marketplace Billing",
  "AI Cost Tracking",
  "GPU Usage Tracking",
  "Enterprise Licensing",
  "Customer Usage Analytics",
] as const;

export type UsageRecord = {
  tenantId: string;
  aiCostUsd: number;
  gpuSeconds: number;
  marketplaceCostUsd: number;
  requests: number;
};

export type RevenueSnapshot = {
  tenantId: string;
  totalCostUsd: number;
  requests: number;
  gpuSeconds: number;
};
type UsageRecordInternal = {
  tenantId: string;
  aiCostMicros: number;
  gpuSeconds: number;
  marketplaceCostMicros: number;
  requests: number;
};

function usdToMicros(amountUsd: number): number {
  return Math.round(amountUsd * 1_000_000);
}

function microsToUsd(amountMicros: number): number {
  return Number((amountMicros / 1_000_000).toFixed(6));
}

export class RevenuePlatform {
  private readonly usage = new Map<string, UsageRecordInternal>();

  record(input: UsageRecord): void {
    const current = this.usage.get(input.tenantId) ?? {
      tenantId: input.tenantId,
      aiCostMicros: 0,
      gpuSeconds: 0,
      marketplaceCostMicros: 0,
      requests: 0,
    };

    this.usage.set(input.tenantId, {
      tenantId: input.tenantId,
      aiCostMicros: current.aiCostMicros + usdToMicros(input.aiCostUsd),
      gpuSeconds: current.gpuSeconds + input.gpuSeconds,
      marketplaceCostMicros:
        current.marketplaceCostMicros + usdToMicros(input.marketplaceCostUsd),
      requests: current.requests + input.requests,
    });
  }

  snapshot(tenantId: string): RevenueSnapshot {
    const usage = this.usage.get(tenantId);
    if (!usage) {
      return { tenantId, totalCostUsd: 0, requests: 0, gpuSeconds: 0 };
    }

    const totalCostMicros = usage.aiCostMicros + usage.marketplaceCostMicros;

    return {
      tenantId,
      totalCostUsd: microsToUsd(totalCostMicros),
      requests: usage.requests,
      gpuSeconds: usage.gpuSeconds,
    };
  }
}
