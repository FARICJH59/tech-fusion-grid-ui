import type { ExecutionEvidenceEnvelope } from "./evidence-envelope";
import { verifyExecutionEvidence } from "./evidence-verifier";
import type { ExecutionTransaction } from "./transaction";
import type { ExecutionTransactionRepository } from "./transaction-repository";
import {
  assertTcxPrecondition,
  buildTcxCommitRecord,
  buildTcxPostconditionHash,
  hashTcxCommitRecord,
  requireValidTcxLease,
  type TcxCommitRecord,
  type TcxLeaseRepository,
} from "./tcx-dispatch-governance";

export type TcxCommitFinalizerDependencies = {
  transactions: ExecutionTransactionRepository;
  leases: TcxLeaseRepository;
};

export type TcxCommitResult = {
  transaction: ExecutionTransaction;
  commitRecord: TcxCommitRecord;
  duplicate: boolean;
};

/**
 * Finalizes a successfully executed transaction only after evidence and
 * authority are revalidated. Admission permits execution; finalization proves
 * execution and commits the resulting durable transaction state.
 */
export async function finalizeTcxCommit(
  envelope: ExecutionEvidenceEnvelope,
  dependencies: TcxCommitFinalizerDependencies,
  now = new Date(),
): Promise<TcxCommitResult> {
  const transaction = await dependencies.transactions.get(envelope.transactionId);
  if (!transaction) throw new Error("tcx_commit_transaction_not_found");
  if (transaction.attemptId !== envelope.attemptId) throw new Error("tcx_commit_attempt_mismatch");
  if (transaction.tenantId !== envelope.tenantId) throw new Error("tcx_commit_tenant_mismatch");
  if (transaction.nodeId !== envelope.nodeId) throw new Error("tcx_commit_node_mismatch");

  if (transaction.state === "SUCCEEDED") {
    if (!transaction.commitRecordHash) throw new Error("tcx_commit_record_missing");
    throw new Error("tcx_commit_already_finalized");
  }
  if (transaction.state !== "RUNNING") {
    throw new Error(`tcx_commit_state_not_finalizable:${transaction.state}`);
  }
  if (envelope.status !== "SUCCEEDED") {
    throw new Error("tcx_commit_success_required");
  }

  verifyExecutionEvidence(envelope.receipt, envelope.result, envelope.attestation);
  await requireValidTcxLease(transaction, dependencies.leases, now);

  if (!transaction.preconditionHash) {
    throw new Error("tcx_commit_precondition_missing");
  }
  if (!envelope.preconditionHash) {
    throw new Error("tcx_commit_evidence_precondition_missing");
  }
  assertTcxPrecondition(transaction, envelope.preconditionHash);

  const postconditionHash = buildTcxPostconditionHash(envelope.result);
  const commitRecord = buildTcxCommitRecord({
    transactionId: transaction.transactionId,
    attemptId: transaction.attemptId,
    stateVersion: transaction.stateVersion,
    preconditionHash: transaction.preconditionHash,
    postconditionHash,
    receiptHash: String(envelope.receipt.receipt_hash),
    attestationHash: String(envelope.attestation.attestation_hash),
  }, now.toISOString());
  const commitRecordHash = hashTcxCommitRecord(commitRecord);

  const committed = await dependencies.transactions.update({
    ...transaction,
    state: "SUCCEEDED",
    receiptId: String(envelope.receipt.receipt_id),
    receiptHash: String(envelope.receipt.receipt_hash),
    resultId: String(envelope.result.result_id),
    resultHash: String(envelope.result.result_hash),
    attestationId: String(envelope.attestation.attestation_id),
    attestationHash: String(envelope.attestation.attestation_hash),
    commitRecordHash,
  }, transaction.stateVersion);

  return { transaction: committed, commitRecord, duplicate: false };
}
