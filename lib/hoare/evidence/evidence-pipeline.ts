import { createEvidenceEnvelope, type EvidenceEnvelopeInput } from "./evidence-envelope";
import { verifyEvidence } from "./evidence-verifier";
import { reconcileEvidence } from "../reconciliation/reconcile";
import { finalizeCommit, type CommitFinalization } from "../commit/commit-finalization";

export interface EvidencePipelineResult {
  evidenceVerified: boolean;
  reconciliationMatched: boolean;
  commit: CommitFinalization | null;
  reasons: string[];
}

export function finalizeEvidencePipeline(
  input: EvidenceEnvelopeInput,
  expectedStateDigest: string,
  reconciliationDigest: string,
): EvidencePipelineResult {
  const envelope = createEvidenceEnvelope(input);
  const verification = verifyEvidence(input, envelope);
  if (!verification.verified) {
    return { evidenceVerified: false, reconciliationMatched: false, commit: null, reasons: verification.reasons };
  }

  const reconciliation = reconcileEvidence(envelope);
  if (!reconciliation.matched) {
    return {
      evidenceVerified: true,
      reconciliationMatched: false,
      commit: null,
      reasons: reconciliation.discrepancies,
    };
  }

  const commit = finalizeCommit(reconciliation, {
    expectedStateDigest,
    resultingStateDigest: input.observedStateDigest,
    reconciliationDigest,
  });

  return { evidenceVerified: true, reconciliationMatched: true, commit, reasons: [] };
}
