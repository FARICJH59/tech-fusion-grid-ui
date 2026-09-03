import { createHash, randomUUID } from "node:crypto";
import type { ExecutionTransactionState } from "./transaction-state";

export type ExecutionTransactionAttempt = {
  attemptId: string;
  attemptNumber: number;
  idempotencyKey: string;
  state: ExecutionTransactionState;
  receiptId?: string;
  receiptHash?: string;
  resultId?: string;
  resultHash?: string;
  attestationId?: string;
  attestationHash?: string;
  completedAt?: string;
};

export type ExecutionTransaction = {
  transactionId: string;
  tenantId: string;
  organizationId?: string;
  projectId: string;
  missionId?: string;
  verticalId?: string;
  profileId?: string;

  releaseDigest: string;
  artifactDigest: string;
  artifactRef: string;

  pasorPlanHash: string;
  pasorUnitId: string;

  workloadId: string;
  agentId: string;
  nodeId: string;
  packId: string;
  runtimeKind: "python" | "native";

  /** TCX concurrency/fencing identity. */
  channelId?: string;
  leaseId?: string;
  expectedStateVersion?: number;
  preconditionHash?: string;
  deadline?: string;

  simulationHash?: string;
  provenanceHash?: string;

  attemptId: string;
  attemptNumber: number;
  idempotencyKey: string;
  attemptHistory?: ExecutionTransactionAttempt[];

  receiptId?: string;
  receiptHash?: string;
  resultId?: string;
  resultHash?: string;
  attestationId?: string;
  attestationHash?: string;

  state: ExecutionTransactionState;
  /** Monotonic optimistic-concurrency version. Incremented on every persisted mutation. */
  stateVersion: number;
  createdAt: string;
  updatedAt: string;
};

export type CreateExecutionTransactionInput = Omit<
  ExecutionTransaction,
  | "transactionId"
  | "attemptId"
  | "attemptNumber"
  | "idempotencyKey"
  | "state"
  | "stateVersion"
  | "createdAt"
  | "updatedAt"
> & {
  transactionId?: string;
  attemptId?: string;
  attemptNumber?: number;
};

export function buildExecutionIdempotencyKey(
  transactionId: string,
  attemptId: string,
): string {
  return `transaction:${transactionId}:attempt:${attemptId}`;
}

export function createExecutionTransaction(
  input: CreateExecutionTransactionInput,
  now = new Date().toISOString(),
): ExecutionTransaction {
  const transactionId = input.transactionId ?? randomUUID();
  const attemptId = input.attemptId ?? randomUUID();
  const attemptNumber = input.attemptNumber ?? 1;

  if (attemptNumber < 1 || !Number.isInteger(attemptNumber)) {
    throw new Error("invalid_execution_transaction_attempt_number");
  }

  const idempotencyKey = buildExecutionIdempotencyKey(
    transactionId,
    attemptId,
  );

  return {
    ...input,
    transactionId,
    attemptId,
    attemptNumber,
    idempotencyKey,
    attemptHistory: input.attemptHistory ?? [],
    state: "CREATED",
    stateVersion: 1,
    createdAt: now,
    updatedAt: now,
  };
}

export function hashExecutionTransactionIdentity(
  transaction: Pick<
    ExecutionTransaction,
    "transactionId" | "attemptId" | "artifactDigest" | "pasorPlanHash" | "pasorUnitId"
  >,
): string {
  return createHash("sha256")
    .update(
      JSON.stringify({
        transactionId: transaction.transactionId,
        attemptId: transaction.attemptId,
        artifactDigest: transaction.artifactDigest,
        pasorPlanHash: transaction.pasorPlanHash,
        pasorUnitId: transaction.pasorUnitId,
      }),
    )
    .digest("hex");
}
