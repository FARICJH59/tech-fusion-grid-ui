import { createHash } from "node:crypto";

export type ExecutionEvidencePayload = Record<string, unknown>;

function sortForCanonicalJson(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortForCanonicalJson);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([key]) => key !== "receipt_hash" && key !== "result_hash" && key !== "attestation_hash")
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, child]) => [key, sortForCanonicalJson(child)]),
    );
  }
  return value;
}

function sha256(value: unknown): string {
  return createHash("sha256")
    .update(JSON.stringify(sortForCanonicalJson(value)), "utf8")
    .digest("hex");
}

function requiredString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`invalid_execution_evidence:${field}`);
  }
  return value;
}

export function verifyExecutionEvidence(
  receipt: ExecutionEvidencePayload,
  result: ExecutionEvidencePayload,
  attestation: ExecutionEvidencePayload,
): void {
  const receiptHash = requiredString(receipt.receipt_hash, "receipt_hash");
  const resultHash = requiredString(result.result_hash, "result_hash");
  const attestationHash = requiredString(attestation.attestation_hash, "attestation_hash");

  if (sha256(receipt) !== receiptHash) throw new Error("receipt_hash_mismatch");
  if (sha256(result) !== resultHash) throw new Error("result_hash_mismatch");
  if (sha256(attestation) !== attestationHash) throw new Error("attestation_hash_mismatch");

  const bindings: Array<[string, ExecutionEvidencePayload, ExecutionEvidencePayload]> = [
    ["receipt_id", receipt, result],
    ["receipt_hash", receipt, result],
    ["receipt_id", receipt, attestation],
    ["receipt_hash", receipt, attestation],
    ["result_id", result, attestation],
    ["result_hash", result, attestation],
  ];

  for (const [field, left, right] of bindings) {
    if (left[field] !== right[field]) throw new Error(`execution_evidence_${field}_mismatch`);
  }

  for (const field of ["workload_id", "agent_id", "node_id", "pack_id", "runtime_kind"]) {
    if (result[field] !== receipt[field]) throw new Error(`execution_evidence_${field}_mismatch`);
    if (attestation[field] !== receipt[field]) throw new Error(`attestation_${field}_mismatch`);
  }
}
