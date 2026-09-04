import { createHash } from "node:crypto";
import type { EvidenceEnvelope, EvidenceVerificationResult, ExecutionAttestation, ExecutionReceipt, ExecutionResult } from "@/packages/hoare-contracts/src";

type LegacyPayload = Record<string, unknown>;

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function hashWithout(value: LegacyPayload, excludedField: string): string {
  const payload = Object.fromEntries(Object.entries(value).filter(([key]) => key !== excludedField));
  return createHash("sha256").update(canonicalJson(payload), "utf8").digest("hex");
}

function legacyReceipt(receipt: ExecutionReceipt): LegacyPayload {
  return {
    receipt_id: receipt.receiptId,
    receipt_hash: receipt.receiptHash,
    transaction_id: receipt.transactionId,
    attempt_id: receipt.attemptId,
    admission_status: receipt.admissionStatus,
    artifact_digest: receipt.artifactDigest,
    release_digest: receipt.releaseDigest,
    pasor_plan_hash: receipt.pasorPlanHash,
    pasor_unit_id: receipt.pasorUnitId,
    producer_identity: receipt.producerIdentity,
    created_at: receipt.createdAt,
  };
}

function legacyResult(result: ExecutionResult, receipt: ExecutionReceipt): LegacyPayload {
  return {
    result_id: result.resultId,
    result_hash: result.resultHash,
    transaction_id: result.transactionId,
    attempt_id: result.attemptId,
    execution_id: result.executionId,
    status: result.status,
    output_digest: result.outputDigest,
    observed_state_digest: result.observedStateDigest,
    started_at: result.startedAt,
    completed_at: result.completedAt,
    error: result.error,
    receipt_id: receipt.receiptId,
    receipt_hash: receipt.receiptHash,
    workload_id: undefined,
    agent_id: undefined,
    node_id: undefined,
    pack_id: undefined,
    runtime_kind: undefined,
  };
}

function legacyAttestation(attestation: ExecutionAttestation, receipt: ExecutionReceipt, result: ExecutionResult): LegacyPayload {
  return {
    attestation_id: attestation.attestationId,
    attestation_hash: attestation.attestationHash,
    transaction_id: attestation.transactionId,
    attempt_id: attestation.attemptId,
    execution_id: attestation.executionId,
    verifier_identity: attestation.verifierIdentity,
    verified: attestation.verified,
    evidence_digest: attestation.evidenceDigest,
    attested_at: attestation.attestedAt,
    reason: attestation.reason,
    result_id: result.resultId,
    result_hash: result.resultHash,
    receipt_id: receipt.receiptId,
    receipt_hash: receipt.receiptHash,
  };
}

function validHash(payload: LegacyPayload, field: string, expected: string): boolean {
  return typeof expected === "string" && expected.length > 0 && hashWithout(payload, field) === expected;
}

export function verifyExecutionEvidence(
  receipt: ExecutionReceipt,
  result: ExecutionResult,
  attestation: ExecutionAttestation,
): EvidenceVerificationResult {
  const discrepancies: string[] = [];
  if (receipt.transactionId !== result.transactionId || receipt.transactionId !== attestation.transactionId) discrepancies.push("transaction_id_mismatch");
  if (receipt.attemptId !== result.attemptId || receipt.attemptId !== attestation.attemptId) discrepancies.push("attempt_id_mismatch");
  if (attestation.executionId !== result.executionId) discrepancies.push("execution_id_mismatch");

  const receiptPayload = legacyReceipt(receipt);
  const resultPayload = legacyResult(result, receipt);
  const attestationPayload = legacyAttestation(attestation, receipt, result);
  if (!validHash(receiptPayload, "receipt_hash", receipt.receiptHash)) discrepancies.push("receipt_hash_mismatch");
  if (!validHash(resultPayload, "result_hash", result.resultHash)) discrepancies.push("result_hash_mismatch");
  if (!validHash(attestationPayload, "attestation_hash", attestation.attestationHash)) discrepancies.push("attestation_hash_mismatch");

  const verified = discrepancies.length === 0 && attestation.verified;
  return {
    evidenceId: `evidence_pending_${receipt.transactionId}_${receipt.attemptId}`,
    verified,
    transactionId: receipt.transactionId,
    attemptId: receipt.attemptId,
    verifiedDigests: verified ? [receipt.receiptHash, result.resultHash, attestation.attestationHash] : [],
    discrepancies,
    reason: verified ? undefined : discrepancies.join(",") || "attestation_not_verified",
    verifiedAt: new Date().toISOString(),
  };
}
