import { createHash } from "node:crypto";
import type { EvidenceEnvelope, ReconciliationResult, Severity } from "@/packages/hoare-contracts/src";

function digest(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value, Object.keys(value as object).sort())).digest("hex");
}

export function reconcileEvidence(evidence: EvidenceEnvelope): ReconciliationResult {
  const discrepancies: ReconciliationResult["discrepancies"] = [];
  const intended = evidence.intendedStateDigest ?? "";
  const observed = evidence.observedStateDigest ?? evidence.result.observedStateDigest ?? "";
  if (!intended || intended !== observed) {
    discrepancies.push({
      field: "observedStateDigest",
      expected: intended,
      observed,
      severity: "HIGH" satisfies Severity,
    });
  }
  const matched = discrepancies.length === 0;
  const reconciliationMaterial = {
    transactionId: evidence.transactionId,
    attemptId: evidence.attemptId,
    matched,
    intendedStateDigest: intended,
    observedStateDigest: observed,
    evidenceDigest: evidence.evidenceDigest,
    discrepancies,
  };
  return {
    reconciliationId: `reconciliation_${digest(reconciliationMaterial).slice(0, 24)}`,
    transactionId: evidence.transactionId,
    attemptId: evidence.attemptId,
    matched,
    intendedStateDigest: intended,
    observedStateDigest: observed,
    evidenceDigest: evidence.evidenceDigest,
    discrepancies,
    severity: matched ? "INFO" : "HIGH",
    recoverable: !matched,
    recommendedAction: matched ? "COMMIT" : "REPAIR",
    reconciledAt: new Date().toISOString(),
  };
}

export function hashReconciliationResult(reconciliation: ReconciliationResult): string {
  const { reconciledAt: _timestamp, ...stable } = reconciliation;
  return digest(stable);
}
