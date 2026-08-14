import type { ExecutionUnit } from "./execution-plan";
import { PasorExecutionDispatcher, type ExecutionContext, type ExecutionHandler, type ExecutionOutcome } from "./execution-dispatcher";
import { evaluateTenantExecutionScope, type TenantExecutionScope } from "../tenant/tenant-execution-scope";

export type TenantScopedExecutionContext = ExecutionContext & {
  tenantScope: TenantExecutionScope;
};

export class TenantScopedPasorDispatcher {
  constructor(private readonly dispatcher: PasorExecutionDispatcher) {}

  register(commandId: string, handler: ExecutionHandler): void {
    this.dispatcher.register(commandId, handler);
  }

  async dispatch(
    plan: { execution_units: ExecutionUnit[] },
    context: TenantScopedExecutionContext,
  ): Promise<ExecutionOutcome[]> {
    for (const unit of plan.execution_units) {
      const decision = evaluateTenantExecutionScope(context.tenantScope, unit.command_id);
      if (!decision.allowed) {
        return plan.execution_units.map((candidate) => ({
          unitId: candidate.unit_id,
          commandId: candidate.command_id,
          status: "blocked" as const,
          reason: candidate.unit_id === unit.unit_id ? decision.reason : "TENANT_SCOPE_BLOCKED",
        }));
      }
    }

    return this.dispatcher.dispatch(plan, context);
  }
}
