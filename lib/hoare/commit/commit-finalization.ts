import type { CommitFinalization, ReconciliationResult } from "@/packages/hoare-contracts/src";
import { sha256Canonical } from "@/packages/hoare-contracts/src";
import { hashReconciliationResult } from "../reconciliation/reconcile";

export interface CommitInput {
  transactionId: string;
  attemptId: string;
  expectedStateVersion: number;
  actualStateVersion: number;
  evidenceDigest: string;
  resultingStateDigest: string;
  finalizationAuthority: string;
}

export function finalizeCommit(
  reconciliation: ReconciliationResult,
  input: CommitInput,
  now = new Date().toISOString(),
): CommitFinalization {
  if (!reconciliation.matched) throw new Error("commit_reconciliation_mismatch");
  if (reconciliation.transactionId !== input.transactionId || reconciliation.attemptId !== input.attemptId) {
    throw new Error("commit_transaction_identity_mismatch");
  }
  if (input.expectedStateVersion !== input.actualStateVersion) throw new Error("commit_state_version_conflict");
  if (input.resultingStateDigest !== reconciliation.observedStateDigest) throw new Error("commit_state_digest_mismatch");
  if (!input.finalizationAuthority) throw new Error("commit_finalization_authority_missing");
  if (!input.evidenceDigest || input.evidenceDigest !== reconciliation.evidenceDigest) throw new Error("commit_evidence_digest_mismatch");

  const reconciliationDigest = hashReconciliationResult(reconciliation);
  const material = {
    transactionId: input.transactionId,
    attemptId: input.attemptId,
    expectedStateVersion: input.expectedStateVersion,
    evidenceDigest: input.evidenceDigest,
    reconciliationDigest,
    resultingStateDigest: input.resultingStateDigest,
    finalizedAt: now,
    finalizationAuthority: input.finalizationAuthority,
  };
  const commitRecordHash = sha256Canonical(material);

  return {
    commitId: `commit_${commitRecordHash.slice(0, 24)}`,
    transactionId: input.transactionId,
    attemptId: input.attemptId,
    expectedStateVersion: input.expectedStateVersion,
    evidenceDigest: input.evidenceDigest,
    reconciliationDigest,
    resultingStateDigest: input.resultingStateDigest,
    commitRecordHash,
    finalizedAt: now,
    finalizationAuthority: input.finalizationAuthority,
  };
}
