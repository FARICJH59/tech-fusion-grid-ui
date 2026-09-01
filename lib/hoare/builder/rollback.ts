import type { BuilderPlan } from "./types";
import type { ExecutionJournal } from "./operations";
import { rollbackJournal } from "./operations";

export type RollbackResult = {
  plan: BuilderPlan;
  journal: ExecutionJournal;
  status: "rolled_back";
};

export function rollbackBuilderExecution(
  plan: BuilderPlan,
  journal: ExecutionJournal,
): RollbackResult {
  if (journal.planId !== plan.id) throw new Error("Rollback journal does not match builder plan");
  if (journal.status !== "completed" && journal.status !== "failed") {
    throw new Error(`Rollback requires a completed or failed execution; received ${journal.status}`);
  }

  return {
    plan: { ...plan, status: "failed" },
    journal: rollbackJournal(journal),
    status: "rolled_back",
  };
}
