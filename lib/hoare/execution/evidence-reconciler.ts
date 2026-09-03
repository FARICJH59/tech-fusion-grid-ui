import type { ExecutionTransaction } from "./transaction";
import type { ExecutionTransactionRepository } from "./transaction-repository";
import type { ExecutionEvidenceEnvelope } from "./evidence-envelope";
import { verifyExecutionEvidence } from "./evidence-verifier";
import { canTransitionExecutionTransaction } from "./transaction-state";

export class ExecutionEvidenceReconciler {
  constructor(private readonly repository: ExecutionTransactionRepository) {}

  async reconcile(envelope: ExecutionEvidenceEnvelope): Promise<ExecutionTransaction> {
    const transaction = await this.repository.get(envelope.transactionId);
    if (!transaction) throw new Error("execution_transaction_not_found");
    if (transaction.attemptId !== envelope.attemptId) throw new Error("execution_evidence_attempt_mismatch");
    if (transaction.tenantId !== envelope.tenantId) throw new Error("execution_evidence_tenant_mismatch");
    if (transaction.nodeId !== envelope.nodeId) throw new Error("execution_evidence_node_mismatch");

    verifyExecutionEvidence(envelope.receipt, envelope.result, envelope.attestation);

    if (envelope.receipt.receipt_id !== transaction.receiptId && transaction.receiptId) {
      throw new Error("execution_evidence_receipt_mismatch");
    }
    if (envelope.result.result_id !== transaction.resultId && transaction.resultId) {
      throw new Error("execution_evidence_result_mismatch");
    }
    if (envelope.attestation.attestation_id !== transaction.attestationId && transaction.attestationId) {
      throw new Error("execution_evidence_attestation_mismatch");
    }

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
      receiptId: String(envelope.receipt.receipt_id),
      receiptHash: String(envelope.receipt.receipt_hash),
      resultId: String(envelope.result.result_id),
      resultHash: String(envelope.result.result_hash),
      attestationId: String(envelope.attestation.attestation_id),
      attestationHash: String(envelope.attestation.attestation_hash),
      updatedAt: envelope.emittedAt,
    });
  }
}
