import { verifyExecutionEvidence, type ExecutionEvidencePayload } from "../execution/evidence-verifier";
import { createEvidenceEnvelope, type EvidenceEnvelope } from "./evidence-envelope";
import { reconcileEvidence, type ReconciliationResult } from "../reconciliation/reconcile";

export interface ProductionEvidenceInput {
  transactionId: string;
  attemptId: string;
  receipt: ExecutionEvidencePayload;
  result: ExecutionEvidencePayload;
  attestation: ExecutionEvidencePayload;
  intendedStateDigest: string;
  observedStateDigest: string;
}

export interface ProductionEvidenceOutcome {
  evidence: EvidenceEnvelope;
  reconciliation: ReconciliationResult;
}

/**
 * Production gate: cryptographically verify execution evidence before any
 * state reconciliation is allowed to produce a commit candidate.
 */
export function processProductionEvidence(input: ProductionEvidenceInput): ProductionEvidenceOutcome {
  verifyExecutionEvidence(input.receipt, input.result, input.attestation);

  const evidence = createEvidenceEnvelope({
    transactionId: input.transactionId,
    attemptId: input.attemptId,
    receipt: input.receipt,
    result: input.result,
    attestation: input.attestation,
    intendedStateDigest: input.intendedStateDigest,
    observedStateDigest: input.observedStateDigest,
  });

  return { evidence, reconciliation: reconcileEvidence(evidence) };
}
