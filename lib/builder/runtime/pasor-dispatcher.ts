import type { ExecutionUnit, PasorPlan } from "../pasor/brain-adapter";
import type { SimulationResult } from "../simulation/pasor-simulator";
import { authorizeExecution, type ExecutionGateRequest } from "../governance/execution-gate";

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

export type DispatchAuthorization = Omit<ExecutionGateRequest, "action" | "quotaCost"> & {
  quotaRemaining?: number;
};

function validateExecutionOrder(plan: PasorPlan, executionOrder: string[][]): Map<string, number> {
  const units = new Map(plan.execution_units.map((unit) => [unit.unit_id, unit]));
  const waves = new Map<string, number>();
  for (let wave = 0; wave < executionOrder.length; wave += 1) {
    for (const unitId of executionOrder[wave]) {
      if (!units.has(unitId)) throw new Error(`UNKNOWN_SIMULATION_UNIT:${unitId}`);
      if (waves.has(unitId)) throw new Error(`DUPLICATE_SIMULATION_UNIT:${unitId}`);
      waves.set(unitId, wave);
    }
  }

  if (waves.size !== units.size) {
    throw new Error("INCOMPLETE_SIMULATION_EXECUTION_ORDER");
  }

  for (const unit of units.values()) {
    const wave = waves.get(unit.unit_id)!;
    for (const dependency of unit.dependencies) {
      const dependencyWave = waves.get(dependency);
      if (dependencyWave === undefined) throw new Error(`UNSIMULATED_DEPENDENCY:${unit.unit_id}:${dependency}`);
      if (dependencyWave >= wave) {
        throw new Error(`INVALID_SIMULATION_ORDER:${dependency}:${unit.unit_id}`);
      }
    }
  }

  return waves;
}

/**
 * Runtime boundary for PASOR. A raw Brain proposal cannot reach the executor:
 * the plan must have a complete simulation order and every executable unit
 * must pass the tenant IAM/capability/quota admission gate.
 *
 * Independent units in the same simulation wave execute concurrently. A unit
 * is only considered completed for dependency purposes after its runtime
 * executor succeeds; DEFERRED, DENIED, and FAILED work therefore blocks
 * dependent units from executing in the current dispatch.
 */
export async function dispatchPasorPlan(
  plan: PasorPlan,
  simulation: SimulationResult,
  executor: RuntimeExecutor,
  scheduler: RuntimeScheduler,
  authorization: DispatchAuthorization,
): Promise<DispatchRecord[]> {
  const planUnits = new Map(plan.execution_units.map((unit) => [unit.unit_id, unit]));
  const simulated = new Map(simulation.decisions.map((decision) => [decision.unit_id, decision]));
  const waves = validateExecutionOrder(plan, simulation.execution_order);
  const records = new Map<string, DispatchRecord>();

  for (const unitId of plan.execution_units.map((unit) => unit.unit_id)) {
    const decision = simulated.get(unitId);
    if (!decision) throw new Error(`UNSIMULATED_UNIT:${unitId}`);
  }

  const waveIds = [...new Set(waves.values())].sort((a, b) => a - b);

  for (const wave of waveIds) {
    const unitIds = [...waves.entries()]
      .filter(([, unitWave]) => unitWave === wave)
      .map(([unitId]) => unitId);

    await Promise.all(unitIds.map(async (unitId) => {
      const unit = planUnits.get(unitId)!;
      const decision = simulated.get(unitId)!;
      const started = new Date().toISOString();
      let status: DispatchStatus;
      let reason = decision.reason;

      const upstreamBlocked = unit.dependencies.some((dependency) => {
        const dependencyRecord = records.get(dependency);
        return !dependencyRecord || dependencyRecord.status !== "EXECUTED";
      });

      if (upstreamBlocked) {
        status = "DENIED";
        reason = "UPSTREAM_NOT_EXECUTED";
      } else if (decision.status === "DENY") {
        status = "DENIED";
      } else if (decision.status === "DEFER") {
        await scheduler(unit);
        status = "DEFERRED";
      } else {
        const gate = authorizeExecution({
          principal: authorization.principal,
          entitlement: authorization.entitlement,
          action: unit.command_id,
          quotaCost: unit.quota_cost,
        });

        if (!gate.allowed) {
          status = "DENIED";
          reason = gate.reason;
        } else {
          try {
            await executor(unit);
            status = "EXECUTED";
          } catch (error) {
            status = "FAILED";
            reason = error instanceof Error ? error.message : "RUNTIME_EXECUTION_FAILED";
          }
        }
      }

      records.set(unit.unit_id, {
        unit_id: unit.unit_id,
        command_id: unit.command_id,
        status,
        reason,
        started_at: started,
        finished_at: new Date().toISOString(),
      });
    }));
  }

  return plan.execution_units.map((unit) => records.get(unit.unit_id)!);
}
