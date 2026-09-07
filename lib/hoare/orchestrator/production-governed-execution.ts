import type {
  AuthorizationDecision,
  EvidenceEnvelope,
  EvidenceVerificationResult,
  ExecutionAttestation,
  ExecutionReceipt,
  ExecutionResult,
  ReconciliationResult,
  TCXTransaction,
  VerificationResult,
  CommitFinalization,
} from "@/packages/hoare-contracts/src";
import { processProductionEvidence } from "../evidence/production-evidence-gate";
import { finalizeCommit } from "../commit/commit-finalization";
import type { ExecutionTransaction } from "../execution/transaction";
import type { ExecutionTransactionRepository } from "../execution/transaction-repository";

export type ProductionExecutionOutcome = {
  receipt: ExecutionReceipt;
  result: ExecutionResult;
  attestation: ExecutionAttestation;
};

export type ProductionFinalizationInput = {
  transaction: TCXTransaction;
  authorization: AuthorizationDecision;
  verification: VerificationResult;
  outcome: ProductionExecutionOutcome;
  intendedStateDigest: string;
  producerIdentity: string;
  runtimeIdentity: string;
  nodeIdentity?: string;
  finalizationAuthority: string;
};

export type ProductionFinalizationResult = {
  evidence: EvidenceEnvelope;
  evidenceVerification: EvidenceVerificationResult;
  reconciliation: ReconciliationResult;
  commit?: CommitFinalization;
  transaction?: ExecutionTransaction;
};

function requireRepositoryTransaction(transaction: TCXTransaction, stored: ExecutionTransaction | null): ExecutionTransaction {
  if (!stored) throw new Error("execution_transaction_not_found");
  if (stored.transactionId !== transaction.transactionId || stored.attemptId !== transaction.attemptId) {
    throw new Error("execution_transaction_identity_mismatch");
  }
  return stored;
}

/**
 * Authoritative post-execution boundary. Evidence is verified first; only a
 * matching reconciliation can move a real TCX transaction to SUCCEEDED and
 * produce a commit record. The repository CAS is the durability boundary.
 */
export async function finalizeProductionExecution(
  input: ProductionFinalizationInput,
  repository: ExecutionTransactionRepository,
): Promise<ProductionFinalizationResult> {
  if (input.outcome.result.status !== "completed") throw new Error(`execution_not_completed:${input.outcome.result.status}`);
  if (!input.authorization.allowed) throw new Error("authorization_not_finalization_authorized");
  if (!input.verification.verified) throw new Error("formal_verification_not_verified");

  const processed = processProductionEvidence({
    tenantId: input.transaction.tenantId,
    projectId: input.transaction.projectId,
    transactionId: input.transaction.transactionId,
    attemptId: input.transaction.attemptId,
    executionId: input.outcome.result.executionId,
    artifactDigest: input.transaction.artifactDigest,
    releaseDigest: input.transaction.releaseDigest,
    pasorPlanHash: input.transaction.pasorPlanHash,
    pasorUnitId: input.transaction.pasorUnitId,
    receipt: input.outcome.receipt,
    result: input.outcome.result,
    attestation: input.outcome.attestation,
    intendedStateDigest: input.intendedStateDigest,
    producerIdentity: input.producerIdentity,
    runtimeIdentity: input.runtimeIdentity,
    nodeIdentity: input.nodeIdentity,
  });

  if (!processed.evidenceVerification.verified || !processed.reconciliation.matched) {
    return processed;
  }

  const stored = requireRepositoryTransaction(input.transaction, await repository.get(input.transaction.transactionId));
  if (stored.attemptId !== input.transaction.attemptId) throw new Error("execution_transaction_attempt_conflict");
  if (stored.state !== "RUNNING") throw new Error(`execution_transaction_state_conflict:${stored.state}`);

  const succeeded = await repository.transition(
    stored.transactionId,
    "RUNNING",
    "SUCCEEDED",
    stored.stateVersion,
  );

  const commit = finalizeCommit(processed.reconciliation, {
    transactionId: succeeded.transactionId,
    attemptId: succeeded.attemptId,
    expectedStateVersion: succeeded.stateVersion,
    actualStateVersion: succeeded.stateVersion,
    evidenceDigest: processed.evidence.evidenceDigest,
    resultingStateDigest: processed.reconciliation.observedStateDigest,
    finalizationAuthority: input.finalizationAuthority,
  });

  const finalized = await repository.update(
    {
      ...succeeded,
      receiptId: input.outcome.receipt.receiptId,
      receiptHash: input.outcome.receipt.receiptHash,
      resultId: input.outcome.result.resultId,
      resultHash: input.outcome.result.resultHash,
      attestationId: input.outcome.attestation.attestationId,
      attestationHash: input.outcome.attestation.attestationHash,
      commitRecordHash: commit.commitRecordHash,
    },
    succeeded.stateVersion,
  );

  return { ...processed, commit, transaction: finalized };
}
