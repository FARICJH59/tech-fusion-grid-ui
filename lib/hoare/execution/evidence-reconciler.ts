import type { ExecutionTransaction } from "./transaction";
import type { ExecutionTransactionRepository } from "./transaction-repository";
import type { ExecutionEvidenceEnvelope } from "./evidence-envelope";
import { verifyExecutionEvidence } from "./evidence-verifier";
import { canTransitionExecutionTransaction } from "./transaction-state";
import { finalizeTcxCommit } from "./tcx-commit-finalizer";
import type { TcxLeaseRepository } from "./tcx-dispatch-governance";

export type ExecutionEvidenceReconcilerDependencies = {
  transactions: ExecutionTransactionRepository;
  leases: TcxLeaseRepository;
};

/**
 * Reconcile execution evidence without allowing a legacy evidence path to
 * bypass TCX commit governance.
 *
 * Successful evidence is finalized exclusively by TCX. Non-success terminal
 * evidence remains on the legacy repair/retry state machine, but is persisted
 * with an optimistic state-version fence.
 */
export class ExecutionEvidenceReconciler {
  private readonly transactions: ExecutionTransactionRepository;
  private readonly leases?: TcxLeaseRepository;

  constructor(
    repositoryOrDependencies: ExecutionTransactionRepository | ExecutionEvidenceReconcilerDependencies,
  ) {
    if ("transactions" in repositoryOrDependencies) {
      this.transactions = repositoryOrDependencies.transactions;
      this.leases = repositoryOrDependencies.leases;
    } else {
      this.transactions = repositoryOrDependencies;
    }
  }

  async reconcile(envelope: ExecutionEvidenceEnvelope): Promise<ExecutionTransaction> {
    const transaction = await this.transactions.get(envelope.transactionId);
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

    if (envelope.status === "SUCCEEDED") {
      if (!this.leases) throw new Error("tcx_commit_lease_repository_required");
      const finalized = await finalizeTcxCommit(envelope, {
        transactions: this.transactions,
        leases: this.leases,
      });
      return finalized.transaction;
    }

    const target = envelope.status === "TIMEOUT"
      ? "TIMEOUT"
      : envelope.status === "REJECTED" ? "REJECTED" : "EXECUTION_FAILED";

    if (!canTransitionExecutionTransaction(transaction.state, target)) {
      throw new Error(`invalid_execution_evidence_transition:${transaction.state}:${target}`);
    }

    if (envelope.stateVersion !== undefined && envelope.stateVersion !== transaction.stateVersion) {
      throw new Error("execution_evidence_state_version_mismatch");
    }

    const updated: ExecutionTransaction = {
      ...transaction,
      state: target,
      receiptId: String(envelope.receipt.receipt_id),
      receiptHash: String(envelope.receipt.receipt_hash),
      resultId: String(envelope.result.result_id),
      resultHash: String(envelope.result.result_hash),
      attestationId: String(envelope.attestation.attestation_id),
      attestationHash: String(envelope.attestation.attestation_hash),
      updatedAt: envelope.emittedAt,
    };

    return this.transactions.update(updated, transaction.stateVersion);
  }
}
