import type { ExecutionUnit, PasorPlan } from "../pasor/brain-adapter";
import type { DispatchRecord } from "../runtime/pasor-dispatcher";

export type ExecutionMeterPolicy = {
  quotaUnitPriceUsd: number;
  energyUnitPriceUsd: number;
  carbonPriceUsdPerKg: number;
  energyKwhPerCostUnit: number;
  carbonKgPerKwh: number;
};

export type ExecutionMeterEvent = {
  tenantId: string;
  projectId: string;
  unitId: string;
  commandId: string;
  status: DispatchRecord["status"];
  quotaConsumed: number;
  energyKwh: number;
  carbonKg: number;
  revenueUsd: number;
  recordedAt: string;
};

export function meterExecution(
  plan: PasorPlan,
  records: DispatchRecord[],
  policy: ExecutionMeterPolicy,
): ExecutionMeterEvent[] {
  const units = new Map(plan.execution_units.map((unit) => [unit.unit_id, unit]));

  return records.map((record) => {
    const unit = units.get(record.unit_id);
    if (!unit) throw new Error(`UNKNOWN_EXECUTION_UNIT:${record.unit_id}`);

    const billable = record.status === "EXECUTED";
    const quotaConsumed = billable ? unit.quota_cost : 0;
    const energyKwh = billable ? unit.energy_cost * policy.energyKwhPerCostUnit : 0;
    const carbonKg = energyKwh * policy.carbonKgPerKwh;
    const revenueUsd = billable
      ? quotaConsumed * policy.quotaUnitPriceUsd + energyKwh * policy.energyUnitPriceUsd + carbonKg * policy.carbonPriceUsdPerKg
      : 0;

    return {
      tenantId: plan.tenant_id,
      projectId: plan.project_id,
      unitId: unit.unit_id,
      commandId: unit.command_id,
      status: record.status,
      quotaConsumed,
      energyKwh,
      carbonKg,
      revenueUsd,
      recordedAt: new Date().toISOString(),
    };
  });
}
