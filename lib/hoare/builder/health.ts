import type { BuilderPlan } from "./types";
import type { ExecutionJournal } from "./operations";

export type BuilderHealth = "healthy" | "degraded" | "failed";

export type HealthCheckResult = {
  planId: string;
  status: BuilderHealth;
  checks: Array<{ name: string; ok: boolean; detail?: string }>;
};

export function evaluateExecutionHealth(
  plan: BuilderPlan,
  journal: ExecutionJournal,
): HealthCheckResult {
  if (journal.planId !== plan.id) {
    throw new Error("Health journal does not match builder plan");
  }

  const checks = [
    {
      name: "execution-completed",
      ok: journal.status === "completed",
      detail: `execution status: ${journal.status}`,
    },
    {
      name: "operations-succeeded",
      ok: journal.operations.length > 0 && journal.operations.every((operation) => operation.status === "succeeded"),
    },
  ];

  const status: BuilderHealth = checks.every((check) => check.ok)
    ? "healthy"
    : checks.some((check) => check.ok)
      ? "degraded"
      : "failed";

  return { planId: plan.id, status, checks };
}
