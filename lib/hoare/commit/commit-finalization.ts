import type { ReconciliationResult } from "../reconciliation/reconcile";

export interface CommitFinalization {
  transactionId: string;
  attemptId: string;
  evidenceDigest: string;
  reconciliationDigest: string;
  resultingStateDigest: string;
  finalizedAt: string;
}

export interface CommitInput {
  expectedStateDigest: string;
  resultingStateDigest: string;
  reconciliationDigest: string;
}

export function finalizeCommit(
  reconciliation: ReconciliationResult,
  input: CommitInput,
): CommitFinalization {
  if (!reconciliation.matched) {
    throw new Error("commit_reconciliation_mismatch");
  }
  if (input.expectedStateDigest !== input.resultingStateDigest) {
    throw new Error("commit_state_digest_mismatch");
  }
  return {
    transactionId: reconciliation.transactionId,
    attemptId: reconciliation.attemptId,
    evidenceDigest: reconciliation.evidenceDigest,
    reconciliationDigest: input.reconciliationDigest,
    resultingStateDigest: input.resultingStateDigest,
    finalizedAt: new Date().toISOString(),
  };
}
