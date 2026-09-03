import { randomUUID } from "node:crypto";
import { autonomousEventBus, AutonomousEventBus } from "@/lib/events/event-bus";
import type { ExecutionTransaction } from "./transaction";
import {
  buildExecutionIdempotencyKey,
  buildExecutionTransactionEvent,
} from "./transaction-events";
import {
  canTransitionExecutionTransaction,
  type ExecutionTransactionState,
} from "./transaction-state";
import type { ExecutionTransactionRepository } from "./transaction-repository";
import { buildExecutionIdempotencyKey as buildAttemptIdempotencyKey } from "./transaction";

export class ExecutionTransactionCoordinator {
  constructor(
    private readonly repository: ExecutionTransactionRepository,
    private readonly eventBus: AutonomousEventBus = autonomousEventBus,
  ) {}

  async create(transaction: ExecutionTransaction): Promise<ExecutionTransaction> {
    const created = await this.repository.create(transaction);
    await this.publish(created, "execution-transaction-created", "high");
    return created;
  }

  async transition(
    transactionId: string,
    to: ExecutionTransactionState,
  ): Promise<ExecutionTransaction> {
    const current = await this.repository.get(transactionId);
    if (!current) throw new Error("execution_transaction_not_found");

    if (!canTransitionExecutionTransaction(current.state, to)) {
      throw new Error(
        `invalid_execution_transaction_transition:${current.state}:${to}`,
      );
    }

    const updated = await this.repository.transition(transactionId, current.state, to);
    await this.publish(updated, this.eventTypeForState(to), this.priorityForState(to));
    return updated;
  }

  /**
   * Rotate a failed transaction onto a new execution attempt.
   * The previous attempt is retained as immutable history. Authorization
   * must still transition the new attempt from RETRY_PENDING to AUTHORIZED
   * before dispatch.
   */
  async prepareRetry(
    transactionId: string,
    maxAttempts: number,
    now = new Date().toISOString(),
  ): Promise<ExecutionTransaction> {
    if (!Number.isInteger(maxAttempts) || maxAttempts < 1) {
      throw new Error("invalid_execution_transaction_max_attempts");
    }

    const current = await this.repository.get(transactionId);
    if (!current) throw new Error("execution_transaction_not_found");
    if (!["REPAIRING", "RETRY_PENDING"].includes(current.state)) {
      throw new Error(`execution_transaction_not_retryable:${current.state}`);
    }
    if (current.attemptNumber >= maxAttempts) {
      throw new Error("execution_transaction_max_attempts_exceeded");
    }

    let repairState = current;
    if (current.state === "REPAIRING") {
      repairState = await this.repository.transition(
        transactionId,
        "REPAIRING",
        "RETRY_PENDING",
      );
      await this.publish(repairState, "execution-transaction-retry-requested", "high");
    }

    const previousAttempt = {
      attemptId: repairState.attemptId,
      attemptNumber: repairState.attemptNumber,
      idempotencyKey: repairState.idempotencyKey,
      state: repairState.state,
      receiptId: repairState.receiptId,
      receiptHash: repairState.receiptHash,
      resultId: repairState.resultId,
      resultHash: repairState.resultHash,
      attestationId: repairState.attestationId,
      attestationHash: repairState.attestationHash,
      completedAt: repairState.updatedAt,
    };

    const attemptId = randomUUID();
    const updated: ExecutionTransaction = {
      ...repairState,
      attemptId,
      attemptNumber: repairState.attemptNumber + 1,
      idempotencyKey: buildAttemptIdempotencyKey(transactionId, attemptId),
      attemptHistory: [...(repairState.attemptHistory ?? []), previousAttempt],
      receiptId: undefined,
      receiptHash: undefined,
      resultId: undefined,
      resultHash: undefined,
      attestationId: undefined,
      attestationHash: undefined,
      state: "RETRY_PENDING",
      updatedAt: now,
    };

    const saved = await this.repository.update(updated);
    await this.publish(saved, "execution-transaction-retry-requested", "high");
    return saved;
  }

  async get(transactionId: string): Promise<ExecutionTransaction | null> {
    return this.repository.get(transactionId);
  }

  private async publish(
    transaction: ExecutionTransaction,
    type: Parameters<typeof buildExecutionTransactionEvent>[1],
    priority: Parameters<typeof buildExecutionTransactionEvent>[2],
  ): Promise<void> {
    const accepted = await this.eventBus.publish(
      buildExecutionTransactionEvent(transaction, type, priority),
    );

    if (!accepted) {
      throw new Error("execution_transaction_event_duplicate");
    }
  }

  private eventTypeForState(
    state: ExecutionTransactionState,
  ): Parameters<typeof buildExecutionTransactionEvent>[1] {
    const map: Partial<Record<ExecutionTransactionState, Parameters<typeof buildExecutionTransactionEvent>[1]>> = {
      AUTHORIZED: "execution-transaction-authorized",
      DISPATCHED: "execution-transaction-dispatched",
      ADMITTED: "execution-transaction-admitted",
      RUNNING: "execution-transaction-started",
      SUCCEEDED: "execution-transaction-completed",
      EXECUTION_FAILED: "execution-transaction-failed",
      TIMEOUT: "execution-transaction-timeout",
      REPAIRING: "execution-transaction-repair-requested",
      RETRY_PENDING: "execution-transaction-retry-requested",
      CANCELLED: "execution-transaction-cancelled",
      REJECTED: "execution-transaction-failed",
      AUTHORIZATION_FAILED: "execution-transaction-failed",
      DELIVERY_FAILED: "execution-transaction-failed",
    };

    const eventType = map[state];
    if (!eventType) throw new Error(`execution_transaction_event_unmapped:${state}`);
    return eventType;
  }

  private priorityForState(state: ExecutionTransactionState): Parameters<typeof buildExecutionTransactionEvent>[2] {
    if (["EXECUTION_FAILED", "TIMEOUT", "AUTHORIZATION_FAILED", "DELIVERY_FAILED"].includes(state)) {
      return "critical";
    }
    return "high";
  }
}
