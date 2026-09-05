import type { ExecutionTransaction } from "./transaction";
import type { ExecutionTransactionState } from "./transaction-state";
import { canTransitionExecutionTransaction } from "./transaction-state";

export interface ExecutionTransactionRepository {
  create(transaction: ExecutionTransaction): Promise<ExecutionTransaction>;
  get(transactionId: string): Promise<ExecutionTransaction | null>;
  update(transaction: ExecutionTransaction, expectedStateVersion?: number): Promise<ExecutionTransaction>;
  findByAttempt(
    transactionId: string,
    attemptId: string,
  ): Promise<ExecutionTransaction | null>;
  transition(
    transactionId: string,
    from: ExecutionTransactionState,
    to: ExecutionTransactionState,
    expectedStateVersion?: number,
  ): Promise<ExecutionTransaction>;
}

export class InMemoryExecutionTransactionRepository
  implements ExecutionTransactionRepository
{
  private readonly transactions = new Map<string, ExecutionTransaction>();

  async create(transaction: ExecutionTransaction): Promise<ExecutionTransaction> {
    if (this.transactions.has(transaction.transactionId)) {
      throw new Error("execution_transaction_already_exists");
    }

    this.transactions.set(transaction.transactionId, { ...transaction });
    return { ...transaction };
  }

  async get(transactionId: string): Promise<ExecutionTransaction | null> {
    const transaction = this.transactions.get(transactionId);
    return transaction ? { ...transaction } : null;
  }

  async update(
    transaction: ExecutionTransaction,
    expectedStateVersion?: number,
  ): Promise<ExecutionTransaction> {
    const current = this.transactions.get(transaction.transactionId);
    if (!current) throw new Error("execution_transaction_not_found");
    if (
      expectedStateVersion !== undefined &&
      current.stateVersion !== expectedStateVersion
    ) {
      throw new Error("execution_transaction_version_conflict");
    }

    const updated = {
      ...transaction,
      stateVersion: current.stateVersion + 1,
      updatedAt: new Date().toISOString(),
    };
    this.transactions.set(transaction.transactionId, updated);
    return { ...updated };
  }

  async findByAttempt(
    transactionId: string,
    attemptId: string,
  ): Promise<ExecutionTransaction | null> {
    const transaction = this.transactions.get(transactionId);
    if (!transaction || transaction.attemptId !== attemptId) return null;
    return { ...transaction };
  }

  async transition(
    transactionId: string,
    from: ExecutionTransactionState,
    to: ExecutionTransactionState,
    expectedStateVersion?: number,
  ): Promise<ExecutionTransaction> {
    if (!canTransitionExecutionTransaction(from, to)) {
      throw new Error(`invalid_execution_transaction_transition:${from}:${to}`);
    }

    const transaction = this.transactions.get(transactionId);
    if (!transaction) throw new Error("execution_transaction_not_found");
    if (transaction.state !== from) {
      throw new Error("execution_transaction_state_conflict");
    }
    if (
      expectedStateVersion !== undefined &&
      transaction.stateVersion !== expectedStateVersion
    ) {
      throw new Error("execution_transaction_version_conflict");
    }

    const updated = {
      ...transaction,
      state: to,
      stateVersion: transaction.stateVersion + 1,
      updatedAt: new Date().toISOString(),
    };
    this.transactions.set(transactionId, updated);
    return { ...updated };
  }
}
