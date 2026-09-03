import type { ExecutionTransaction } from "./transaction";
import type { ExecutionTransactionRepository } from "./transaction-repository";
import type { ExecutionEvidenceEnvelope } from "./evidence-envelope";
import { canTransitionExecutionTransaction } from "./transaction-state";

export class ExecutionEvidenceReconciler {
  constructor(private readonly repository: ExecutionTransactionRepository) {}

  async reconcile(envelope: ExecutionEvidenceEnvelope): Promise<ExecutionTransaction> {
    const transaction = await this.repository.get(envelope.transactionId);
    if (!transaction) throw new Error("execution_transaction_not_found");
    if (transaction.attemptId !== envelope.attemptId) throw new Error("execution_evidence_attempt_mismatch");
    if (transaction.tenantId !== envelope.tenantId) throw new Error("execution_evidence_tenant_mismatch");
    if (transaction.nodeId !== envelope.nodeId) throw new Error("execution_evidence_node_mismatch");

    const target = envelope.status === "SUCCEEDED"
      ? "SUCCEEDED"
      : envelope.status === "TIMEOUT"
        ? "TIMEOUT"
        : envelope.status === "REJECTED" ? "REJECTED" : "EXECUTION_FAILED";

    if (!canTransitionExecutionTransaction(transaction.state, target)) {
      throw new Error(`invalid_execution_evidence_transition:${transaction.state}:${target}`);
    }

    return this.repository.update({
      ...transaction,
      state: target,
      receiptId: envelope.receiptId,
      receiptHash: envelope.receiptHash,
      resultId: envelope.resultId,
      resultHash: envelope.resultHash,
      attestationId: envelope.attestationId,
      attestationHash: envelope.attestationHash,
      updatedAt: envelope.emittedAt,
    });
  }
}
