import { redis, getRedis } from "@/lib/redis";
import type { ExecutionTransaction } from "./transaction";
import type { ExecutionTransactionRepository } from "./transaction-repository";
import type { ExecutionTransactionState } from "./transaction-state";
import { canTransitionExecutionTransaction } from "./transaction-state";

const KEY_PREFIX = "phase85:execution:transaction";
const TRANSITION_RETRIES = 3;
function key(transactionId: string): string { if (!transactionId || transactionId.includes("\u0000")) throw new Error("invalid_execution_transaction_id"); return `${KEY_PREFIX}:${transactionId}`; }
function clone(transaction: ExecutionTransaction): ExecutionTransaction { return structuredClone(transaction); }

export class RedisExecutionTransactionRepository implements ExecutionTransactionRepository {
  async create(transaction: ExecutionTransaction): Promise<ExecutionTransaction> {
    const result = await getRedis().set(key(transaction.transactionId), JSON.stringify(transaction), "NX");
    if (result !== "OK") throw new Error("execution_transaction_already_exists");
    return clone(transaction);
  }
  async get(transactionId: string): Promise<ExecutionTransaction | null> {
    const raw = await redis.get(key(transactionId)); if (raw === null) return null;
    try { return JSON.parse(raw) as ExecutionTransaction; } catch (error) { throw new Error("execution_transaction_corrupt", { cause: error }); }
  }
  async update(transaction: ExecutionTransaction, expectedStateVersion?: number): Promise<ExecutionTransaction> {
    const transactionKey = key(transaction.transactionId), client = getRedis(); await client.watch(transactionKey);
    try {
      const raw = await client.get(transactionKey); if (raw === null) throw new Error("execution_transaction_not_found");
      const current = JSON.parse(raw) as ExecutionTransaction;
      if (expectedStateVersion !== undefined && current.stateVersion !== expectedStateVersion) throw new Error("execution_transaction_version_conflict");
      const updated = { ...transaction, stateVersion: current.stateVersion + 1, updatedAt: new Date().toISOString() };
      const result = await client.multi().set(transactionKey, JSON.stringify(updated)).exec();
      if (result === null) throw new Error("execution_transaction_version_conflict"); return clone(updated);
    } catch (error) { await client.unwatch().catch(() => undefined); throw error; }
  }
  async bindAuthority(transactionId: string, attemptId: string, authorizationDecisionId: string, verificationProofId: string, expectedStateVersion: number): Promise<ExecutionTransaction> {
    if (!authorizationDecisionId || !verificationProofId) throw new Error("execution_transaction_authority_binding_required");
    const transactionKey = key(transactionId);
    for (let attempt = 0; attempt < TRANSITION_RETRIES; attempt += 1) {
      const client = getRedis(); await client.watch(transactionKey);
      try {
        const raw = await client.get(transactionKey); if (raw === null) throw new Error("execution_transaction_not_found");
        const current = JSON.parse(raw) as ExecutionTransaction;
        if (current.attemptId !== attemptId) throw new Error("execution_transaction_attempt_conflict");
        if (current.stateVersion !== expectedStateVersion) throw new Error("execution_transaction_version_conflict");
        if (current.authorizationDecisionId || current.verificationProofId) throw new Error("execution_transaction_authority_already_bound");
        const updated = { ...current, authorizationDecisionId, verificationProofId, stateVersion: current.stateVersion + 1, updatedAt: new Date().toISOString() };
        const result = await client.multi().set(transactionKey, JSON.stringify(updated)).exec();
        if (result !== null) return clone(updated);
      } catch (error) { await client.unwatch().catch(() => undefined); throw error; }
    }
    throw new Error("execution_transaction_authority_binding_conflict");
  }
  async findByAttempt(transactionId: string, attemptId: string): Promise<ExecutionTransaction | null> {
    const transaction = await this.get(transactionId); if (!transaction) return null;
    if (transaction.attemptId === attemptId) return transaction;
    if (transaction.attemptHistory?.some((attempt) => attempt.attemptId === attemptId)) return transaction;
    return null;
  }
  async transition(transactionId: string, from: ExecutionTransactionState, to: ExecutionTransactionState, expectedStateVersion?: number): Promise<ExecutionTransaction> {
    if (!canTransitionExecutionTransaction(from, to)) throw new Error(`invalid_execution_transaction_transition:${from}:${to}`);
    const transactionKey = key(transactionId);
    for (let attempt = 0; attempt < TRANSITION_RETRIES; attempt += 1) {
      const client = getRedis(); await client.watch(transactionKey);
      try {
        const raw = await client.get(transactionKey); if (raw === null) throw new Error("execution_transaction_not_found");
        const current = JSON.parse(raw) as ExecutionTransaction;
        if (current.state !== from) throw new Error("execution_transaction_state_conflict");
        if (expectedStateVersion !== undefined && current.stateVersion !== expectedStateVersion) throw new Error("execution_transaction_version_conflict");
        const updated = { ...current, state: to, stateVersion: current.stateVersion + 1, updatedAt: new Date().toISOString() };
        const result = await client.multi().set(transactionKey, JSON.stringify(updated)).exec(); if (result !== null) return clone(updated);
      } catch (error) { await client.unwatch().catch(() => undefined); throw error; }
    }
    throw new Error("execution_transaction_transition_conflict");
  }
}
