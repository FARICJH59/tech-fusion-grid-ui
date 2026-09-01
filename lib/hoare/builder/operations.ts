import type { BuildOperation, BuildProvider, BuildResult } from "./executor";

export type OperationStatus = "pending" | "running" | "succeeded" | "failed" | "rolled_back";

export type TrackedOperation = BuildOperation & {
  id: string;
  status: OperationStatus;
  startedAt?: string;
  completedAt?: string;
  error?: string;
};

export type ExecutionJournal = {
  planId: string;
  provider: BuildProvider;
  status: "accepted" | "completed" | "failed" | "rolled_back";
  operations: TrackedOperation[];
};

export function createExecutionJournal(result: BuildResult): ExecutionJournal {
  return {
    planId: result.planId,
    provider: result.provider,
    status: result.accepted ? "completed" : "failed",
    operations: result.operations.map((operation, index) => ({
      ...operation,
      id: `${result.planId}:op:${index + 1}`,
      status: result.accepted ? "succeeded" : "failed",
    })),
  };
}

export function rollbackJournal(journal: ExecutionJournal): ExecutionJournal {
  return {
    ...journal,
    status: "rolled_back",
    operations: journal.operations.map((operation) => ({
      ...operation,
      status: operation.status === "succeeded" ? "rolled_back" : operation.status,
      completedAt: operation.completedAt ?? new Date().toISOString(),
    })),
  };
}
