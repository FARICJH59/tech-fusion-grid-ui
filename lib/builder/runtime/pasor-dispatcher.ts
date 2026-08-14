import type { ExecutionUnit, PasorPlan } from "../pasor/brain-adapter";
import type { SimulationResult } from "../simulation/pasor-simulator";

export type DispatchStatus = "EXECUTED" | "DEFERRED" | "DENIED" | "FAILED";

export type DispatchRecord = {
  unit_id: string;
  command_id: string;
  status: DispatchStatus;
  reason: string;
  started_at: string;
  finished_at: string;
};

export type RuntimeExecutor = (unit: ExecutionUnit) => Promise<void>;
export type RuntimeScheduler = (unit: ExecutionUnit) => Promise<void>;

/**
 * Runtime boundary for PASOR. The dispatcher accepts only a simulation result
 * produced for the same plan and never accepts a raw Brain proposal.
 */
export async function dispatchPasorPlan(
  plan: PasorPlan,
  simulation: SimulationResult,
  executor: RuntimeExecutor,
  scheduler: RuntimeScheduler,
): Promise<DispatchRecord[]> {
  const planUnits = new Map(plan.execution_units.map((unit) => [unit.unit_id, unit]));
  const simulated = new Map(simulation.decisions.map((decision) => [decision.unit_id, decision]));
  const records: DispatchRecord[] = [];

  for (const unitId of plan.execution_units.map((unit) => unit.unit_id)) {
    const unit = planUnits.get(unitId)!;
    const decision = simulated.get(unitId);
    if (!decision) throw new Error(`UNSIMULATED_UNIT:${unitId}`);

    const started = new Date().toISOString();
    let status: DispatchStatus;
    let reason = decision.reason;

    if (decision.status === "DENY") {
      status = "DENIED";
    } else if (decision.status === "DEFER") {
      await scheduler(unit);
      status = "DEFERRED";
    } else {
      try {
        await executor(unit);
        status = "EXECUTED";
      } catch (error) {
        status = "FAILED";
        reason = error instanceof Error ? error.message : "RUNTIME_EXECUTION_FAILED";
      }
    }

    records.push({
      unit_id: unit.unit_id,
      command_id: unit.command_id,
      status,
      reason,
      started_at: started,
      finished_at: new Date().toISOString(),
    });
  }

  return records;
}
