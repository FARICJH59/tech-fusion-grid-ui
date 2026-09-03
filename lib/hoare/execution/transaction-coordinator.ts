import { autonomousEventBus, AutonomousEventBus } from "@/lib/events/event-bus";
import type { ExecutionTransaction } from "./transaction";
import {
  buildExecutionTransactionEvent,
} from "./transaction-events";
import {
  canTransitionExecutionTransaction,
  type ExecutionTransactionState,
} from "./transaction-state";
import type { ExecutionTransactionRepository } from "./transaction-repository";

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
    if (["REPAIRING", "RETRY_PENDING", "REJECTED"].includes(state)) {
      return "high";
    }
    return "high";
  }
}
