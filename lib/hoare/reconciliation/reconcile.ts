import type { EvidenceEnvelope } from "../evidence/evidence-envelope";

export interface ReconciliationResult {
  transactionId: string;
  attemptId: string;
  matched: boolean;
  intendedStateDigest: string;
  observedStateDigest: string;
  evidenceDigest: string;
  discrepancies: string[];
  severity: "NONE" | "LOW" | "HIGH" | "CRITICAL";
  recoverable: boolean;
}

export function reconcileEvidence(evidence: EvidenceEnvelope): ReconciliationResult {
  const discrepancies: string[] = [];
  if (evidence.intendedStateDigest !== evidence.observedStateDigest) {
    discrepancies.push("observed_state_digest_mismatch");
  }
  const matched = discrepancies.length === 0;
  return {
    transactionId: evidence.transactionId,
    attemptId: evidence.attemptId,
    matched,
    intendedStateDigest: evidence.intendedStateDigest,
    observedStateDigest: evidence.observedStateDigest,
    evidenceDigest: evidence.evidenceDigest,
    discrepancies,
    severity: matched ? "NONE" : "HIGH",
    recoverable: !matched,
  };
}
