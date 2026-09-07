export const EXECUTION_TRANSACTION_STATES = [
  "CREATED",
  "AUTHORIZED",
  "DISPATCHED",
  "ADMITTED",
  "RUNNING",
  "SUCCEEDED",
  "REJECTED",
  "AUTHORIZATION_FAILED",
  "DELIVERY_FAILED",
  "EXECUTION_FAILED",
  "TIMEOUT",
  "REPAIRING",
  "RETRY_PENDING",
  "CANCELLED",
] as const;

export type ExecutionTransactionState =
  (typeof EXECUTION_TRANSACTION_STATES)[number];

const TERMINAL_STATES = new Set<ExecutionTransactionState>([
  "SUCCEEDED",
  "REJECTED",
  "AUTHORIZATION_FAILED",
  "DELIVERY_FAILED",
  "EXECUTION_FAILED",
  "TIMEOUT",
  "CANCELLED",
]);

export function isTerminalExecutionTransactionState(
  state: ExecutionTransactionState,
): boolean {
  return TERMINAL_STATES.has(state);
}

const TRANSITIONS: Record<
  ExecutionTransactionState,
  readonly ExecutionTransactionState[]
> = {
  CREATED: ["AUTHORIZED", "REJECTED", "CANCELLED"],
  AUTHORIZED: ["DISPATCHED", "AUTHORIZATION_FAILED", "CANCELLED"],
  DISPATCHED: ["ADMITTED", "DELIVERY_FAILED", "REJECTED", "CANCELLED"],
  ADMITTED: ["RUNNING", "EXECUTION_FAILED", "TIMEOUT", "REJECTED"],
  RUNNING: ["SUCCEEDED", "EXECUTION_FAILED", "TIMEOUT"],
  SUCCEEDED: [],
  REJECTED: ["REPAIRING"],
  AUTHORIZATION_FAILED: ["REPAIRING"],
  DELIVERY_FAILED: ["REPAIRING"],
  EXECUTION_FAILED: ["REPAIRING"],
  TIMEOUT: ["REPAIRING"],
  REPAIRING: ["RETRY_PENDING", "REJECTED", "CANCELLED"],
  RETRY_PENDING: ["AUTHORIZED", "CANCELLED"],
  CANCELLED: [],
};

export function canTransitionExecutionTransaction(
  from: ExecutionTransactionState,
  to: ExecutionTransactionState,
): boolean {
  return TRANSITIONS[from].includes(to);
}
