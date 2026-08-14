import type { ExecutionUnit } from "./execution-plan";

export type ExecutionContext = {
  tenantId: string;
  simulationApproved: boolean;
  governanceApproved: boolean;
  provenanceVerified: boolean;
  quotaAvailable: boolean;
};

export type ExecutionHandler = (
  unit: ExecutionUnit,
  context: ExecutionContext,
) => Promise<unknown>;

export type ExecutionOutcome = {
  unitId: string;
  commandId: string;
  status: "executed" | "blocked";
  reason: string;
  result?: unknown;
};

export class PasorExecutionDispatcher {
  private readonly handlers = new Map<string, ExecutionHandler>();

  register(commandId: string, handler: ExecutionHandler): void {
    if (!commandId) throw new Error("COMMAND_ID_REQUIRED");
    this.handlers.set(commandId, handler);
  }

  async dispatch(plan: { execution_units: ExecutionUnit[] }, context: ExecutionContext): Promise<ExecutionOutcome[]> {
    const completed = new Set<string>();
    const outcomes: ExecutionOutcome[] = [];
    const pending = [...plan.execution_units];

    while (pending.length) {
      const index = pending.findIndex((unit) => unit.dependencies.every((dependency) => completed.has(dependency)));
      if (index < 0) throw new Error("EXECUTION_DEPENDENCY_CYCLE");

      const [unit] = pending.splice(index, 1);
      if (!context.simulationApproved) {
        outcomes.push({ unitId: unit.unit_id, commandId: unit.command_id, status: "blocked", reason: "SIMULATION_DENIED" });
        continue;
      }
      if (!context.governanceApproved) {
        outcomes.push({ unitId: unit.unit_id, commandId: unit.command_id, status: "blocked", reason: "GOVERNANCE_DENIED" });
        continue;
      }
      if (!context.provenanceVerified) {
        outcomes.push({ unitId: unit.unit_id, commandId: unit.command_id, status: "blocked", reason: "PROVENANCE_UNVERIFIED" });
        continue;
      }
      if (!context.quotaAvailable) {
        outcomes.push({ unitId: unit.unit_id, commandId: unit.command_id, status: "blocked", reason: "QUOTA_UNAVAILABLE" });
        continue;
      }

      const handler = this.handlers.get(unit.command_id);
      if (!handler) {
        if (unit.optional) {
          outcomes.push({ unitId: unit.unit_id, commandId: unit.command_id, status: "blocked", reason: "OPTIONAL_HANDLER_UNAVAILABLE" });
          completed.add(unit.unit_id);
          continue;
        }
        throw new Error(`EXECUTION_HANDLER_NOT_REGISTERED:${unit.command_id}`);
      }

      const result = await handler(unit, context);
      outcomes.push({ unitId: unit.unit_id, commandId: unit.command_id, status: "executed", reason: "EXECUTED", result });
      completed.add(unit.unit_id);
    }

    return outcomes;
  }
}
