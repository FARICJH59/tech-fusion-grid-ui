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
};

/**
 * Canonical post-execution boundary:
 * result -> evidence verification -> envelope -> reconciliation -> commit.
 * No commit is emitted for failed execution, invalid evidence, or drift.
 */
export async function finalizeProductionExecution(
  input: ProductionFinalizationInput,
): Promise<ProductionFinalizationResult> {
  if (input.result.status !== "completed") {
    throw new Error(`execution_not_completed:${input.result.status}`);
  }

  if (!input.authorization.allowed) {
    throw new Error("authorization_not_finalization_authorized");
  }

  if (!input.verification.verified) {
    throw new Error("formal_verification_not_verified");
  }

  const processed = processProductionEvidence({
    tenantId: input.transaction.tenantId,
    organizationId: undefined,
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

  const reconciliation = processed.reconciliation;
  const evidence = processed.evidence;

  if (!processed.evidenceVerification.verified) {
    return { evidence, evidenceVerification: processed.evidenceVerification, reconciliation };
  }

  if (!reconciliation.matched) {
    return { evidence, evidenceVerification: processed.evidenceVerification, reconciliation };
  }

  const commit = finalizeCommit({
    transactionId: input.transaction.transactionId,
    attemptId: input.transaction.attemptId,
    expectedStateVersion: input.transaction.expectedStateVersion,
    evidenceDigest: evidence.evidenceDigest,
    reconciliationDigest: evidence.evidenceDigest,
    resultingStateDigest: reconciliation.observedStateDigest,
    finalizationAuthority: input.finalizationAuthority,
  });

  return { evidence, evidenceVerification: processed.evidenceVerification, reconciliation, commit };
}
