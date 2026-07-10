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

export class RevenuePlatform {
  private readonly usage = new Map<string, UsageRecord>();

  record(input: UsageRecord): void {
    const current = this.usage.get(input.tenantId) ?? {
      tenantId: input.tenantId,
      aiCostUsd: 0,
      gpuSeconds: 0,
      marketplaceCostUsd: 0,
      requests: 0,
    };

    this.usage.set(input.tenantId, {
      tenantId: input.tenantId,
      aiCostUsd: Number((current.aiCostUsd + input.aiCostUsd).toFixed(6)),
      gpuSeconds: current.gpuSeconds + input.gpuSeconds,
      marketplaceCostUsd: Number(
        (current.marketplaceCostUsd + input.marketplaceCostUsd).toFixed(6),
      ),
      requests: current.requests + input.requests,
    });
  }

  snapshot(tenantId: string): RevenueSnapshot {
    const usage = this.usage.get(tenantId);
    if (!usage) {
      return { tenantId, totalCostUsd: 0, requests: 0, gpuSeconds: 0 };
    }

    const totalCostUsd = Number((usage.aiCostUsd + usage.marketplaceCostUsd).toFixed(6));

    return {
      tenantId,
      totalCostUsd,
      requests: usage.requests,
      gpuSeconds: usage.gpuSeconds,
    };
  }
}
