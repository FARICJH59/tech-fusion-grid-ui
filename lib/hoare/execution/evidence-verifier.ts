import { createHash } from "node:crypto";
import type { EvidenceEnvelope, EvidenceVerificationResult, ExecutionAttestation, ExecutionReceipt, ExecutionResult } from "@/packages/hoare-contracts/src";
import type { ExecutionEvidencePayload } from "./evidence-envelope";

type LegacyPayload = Record<string, unknown>;
type EvidenceInput = ExecutionReceipt | ExecutionResult | ExecutionAttestation | ExecutionEvidencePayload;

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

function pick(payload: LegacyPayload, camel: string, snake: string): unknown {
  return payload[camel] ?? payload[snake];
}

function asCanonicalReceipt(input: EvidenceInput): ExecutionReceipt {
  const payload = input as LegacyPayload;
  return {
    receiptId: String(pick(payload, "receiptId", "receipt_id") ?? ""),
    receiptHash: String(pick(payload, "receiptHash", "receipt_hash") ?? ""),
    transactionId: String(pick(payload, "transactionId", "transaction_id") ?? ""),
    attemptId: String(pick(payload, "attemptId", "attempt_id") ?? ""),
    admissionStatus: pick(payload, "admissionStatus", "admission_status") as ExecutionReceipt["admissionStatus"],
    artifactDigest: pick(payload, "artifactDigest", "artifact_digest") as string | undefined,
    releaseDigest: pick(payload, "releaseDigest", "release_digest") as string | undefined,
    pasorPlanHash: pick(payload, "pasorPlanHash", "pasor_plan_hash") as string | undefined,
    pasorUnitId: pick(payload, "pasorUnitId", "pasor_unit_id") as string | undefined,
    producerIdentity: String(pick(payload, "producerIdentity", "producer_identity") ?? ""),
    createdAt: String(pick(payload, "createdAt", "created_at") ?? ""),
  };
}

function asCanonicalResult(input: EvidenceInput): ExecutionResult {
  const payload = input as LegacyPayload;
  return {
    resultId: String(pick(payload, "resultId", "result_id") ?? ""),
    resultHash: String(pick(payload, "resultHash", "result_hash") ?? ""),
    transactionId: String(pick(payload, "transactionId", "transaction_id") ?? ""),
    attemptId: String(pick(payload, "attemptId", "attempt_id") ?? ""),
    executionId: String(pick(payload, "executionId", "execution_id") ?? ""),
    status: pick(payload, "status", "status") as ExecutionResult["status"],
    outputDigest: pick(payload, "outputDigest", "output_digest") as string | undefined,
    observedStateDigest: pick(payload, "observedStateDigest", "observed_state_digest") as string | undefined,
    startedAt: String(pick(payload, "startedAt", "started_at") ?? ""),
    completedAt: pick(payload, "completedAt", "completed_at") as string | undefined,
    error: pick(payload, "error", "error") as string | undefined,
  };
}

function asCanonicalAttestation(input: EvidenceInput): ExecutionAttestation {
  const payload = input as LegacyPayload;
  return {
    attestationId: String(pick(payload, "attestationId", "attestation_id") ?? ""),
    attestationHash: String(pick(payload, "attestationHash", "attestation_hash") ?? ""),
    transactionId: String(pick(payload, "transactionId", "transaction_id") ?? ""),
    attemptId: String(pick(payload, "attemptId", "attempt_id") ?? ""),
    executionId: String(pick(payload, "executionId", "execution_id") ?? ""),
    verifierIdentity: String(pick(payload, "verifierIdentity", "verifier_identity") ?? ""),
    verified: Boolean(pick(payload, "verified", "verified")),
    evidenceDigest: String(pick(payload, "evidenceDigest", "evidence_digest") ?? ""),
    attestedAt: String(pick(payload, "attestedAt", "attested_at") ?? ""),
    reason: pick(payload, "reason", "reason") as string | undefined,
  };
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
  receiptInput: EvidenceInput,
  resultInput: EvidenceInput,
  attestationInput: EvidenceInput,
): EvidenceVerificationResult {
  const receipt = asCanonicalReceipt(receiptInput);
  const result = asCanonicalResult(resultInput);
  const attestation = asCanonicalAttestation(attestationInput);
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
