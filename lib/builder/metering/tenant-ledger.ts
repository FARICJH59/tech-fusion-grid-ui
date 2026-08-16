import type { ExecutionMeterEvent } from "./execution-meter";

export type TenantLedgerEntry = ExecutionMeterEvent & {
  ledgerId: string;
};

export interface TenantLedger {
  append(entry: TenantLedgerEntry): Promise<void>;
  list(tenantId: string, projectId?: string): Promise<TenantLedgerEntry[]>;
  totals(tenantId: string): Promise<{
    quotaConsumed: number;
    energyKwh: number;
    carbonKg: number;
    revenueUsd: number;
  }>;
}

/** In-memory adapter for tests/local development. Production can map this
 * interface to Supabase/Postgres, Cloud SQL, or another durable store. */
export class InMemoryTenantLedger implements TenantLedger {
  private readonly entries: TenantLedgerEntry[] = [];

  async append(entry: TenantLedgerEntry): Promise<void> {
    this.entries.push(entry);
  }

  async list(tenantId: string, projectId?: string): Promise<TenantLedgerEntry[]> {
    return this.entries.filter(
      (entry) => entry.tenantId === tenantId && (!projectId || entry.projectId === projectId),
    );
  }

  async totals(tenantId: string) {
    const entries = await this.list(tenantId);
    return entries.reduce(
      (total, entry) => ({
        quotaConsumed: total.quotaConsumed + entry.quotaConsumed,
        energyKwh: total.energyKwh + entry.energyKwh,
        carbonKg: total.carbonKg + entry.carbonKg,
        revenueUsd: total.revenueUsd + entry.revenueUsd,
      }),
      { quotaConsumed: 0, energyKwh: 0, carbonKg: 0, revenueUsd: 0 },
    );
  }
}
