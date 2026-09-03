import type { ExecutionTransaction } from "./transaction";
import type { ExecutionTransactionState } from "./transaction-state";

export interface ExecutionTransactionRepository {
  create(transaction: ExecutionTransaction): Promise<ExecutionTransaction>;
  get(transactionId: string): Promise<ExecutionTransaction | null>;
  update(transaction: ExecutionTransaction): Promise<ExecutionTransaction>;
  findByAttempt(
    transactionId: string,
    attemptId: string,
  ): Promise<ExecutionTransaction | null>;
  transition(
    transactionId: string,
    from: ExecutionTransactionState,
    to: ExecutionTransactionState,
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

  async update(transaction: ExecutionTransaction): Promise<ExecutionTransaction> {
    if (!this.transactions.has(transaction.transactionId)) {
      throw new Error("execution_transaction_not_found");
    }

    this.transactions.set(transaction.transactionId, { ...transaction });
    return { ...transaction };
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
  ): Promise<ExecutionTransaction> {
    const transaction = this.transactions.get(transactionId);
    if (!transaction) throw new Error("execution_transaction_not_found");
    if (transaction.state !== from) {
      throw new Error("execution_transaction_state_conflict");
    }

    const updated = {
      ...transaction,
      state: to,
      updatedAt: new Date().toISOString(),
    };
    this.transactions.set(transactionId, updated);
    return { ...updated };
  }
}
