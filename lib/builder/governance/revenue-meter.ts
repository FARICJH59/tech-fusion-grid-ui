export type ExecutionMeterEvent = {
  tenantId: string;
  projectId: string;
  unitId: string;
  commandId: string;
  energyCost: number;
  quotaCost: number;
  status: "SIMULATED" | "EXECUTED" | "BLOCKED";
  timestamp?: string;
};

export type RevenueRateCard = {
  executionUnitUsd: number;
  energyUnitUsd: number;
  quotaUnitUsd: number;
};

export type RevenueSnapshot = {
  tenantId: string;
  projectId?: string;
  executionUnits: number;
  energyUnits: number;
  quotaUnits: number;
  billableUsd: number;
};

/**
 * Deterministic, in-process usage meter. Persistence and payment collection
 * remain outside the builder core; this produces billable usage events that
 * can be forwarded to the existing RevenuePlatform/Stripe adapter.
 */
export class GovernedExecutionRevenueMeter {
  private readonly events: ExecutionMeterEvent[] = [];

  constructor(
    private readonly rates: RevenueRateCard = {
      executionUnitUsd: 0.01,
      energyUnitUsd: 0.002,
      quotaUnitUsd: 0.01,
    },
  ) {}

  record(event: ExecutionMeterEvent): void {
    if (!event.tenantId || !event.projectId || !event.unitId || !event.commandId) {
      throw new Error("INVALID_USAGE_EVENT");
    }
    this.events.push({ ...event, timestamp: event.timestamp ?? new Date().toISOString() });
  }

  snapshot(tenantId: string, projectId?: string): RevenueSnapshot {
    const events = this.events.filter(
      (event) => event.tenantId === tenantId && (!projectId || event.projectId === projectId),
    );
    const billable = events.filter((event) => event.status === "EXECUTED");
    const executionUnits = billable.length;
    const energyUnits = billable.reduce((sum, event) => sum + event.energyCost, 0);
    const quotaUnits = billable.reduce((sum, event) => sum + event.quotaCost, 0);
    const billableUsd = Number(
      (
        executionUnits * this.rates.executionUnitUsd +
        energyUnits * this.rates.energyUnitUsd +
        quotaUnits * this.rates.quotaUnitUsd
      ).toFixed(6),
    );

    return { tenantId, projectId, executionUnits, energyUnits, quotaUnits, billableUsd };
  }

  eventsFor(tenantId: string): ExecutionMeterEvent[] {
    return this.events.filter((event) => event.tenantId === tenantId).map((event) => ({ ...event }));
  }
}
