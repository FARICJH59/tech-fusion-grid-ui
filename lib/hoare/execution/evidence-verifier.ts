import { createHash } from "node:crypto";

export type ExecutionEvidencePayload = Record<string, unknown>;

function sortForCanonicalJson(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortForCanonicalJson);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        // Python's json.dumps(sort_keys=True) uses deterministic lexical key order.
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
        .map(([key, child]) => [key, sortForCanonicalJson(child)]),
    );
  }
  return value;
}

/**
 * Match the existing Python evidence hash contract:
 * json.dumps(sort_keys=True, separators=(",", ":"), ensure_ascii=True).
 * JSON.stringify already matches the compact separators and JSON scalar
 * representation needed here; escaping non-ASCII UTF-16 code units makes its
 * output compatible with Python's ensure_ascii=True behavior.
 */
function canonicalJson(value: unknown): string {
  const json = JSON.stringify(sortForCanonicalJson(value));
  if (json === undefined) throw new Error("execution_evidence_non_json_value");

  return json.replace(/[\u007f-\uffff]/g, (character) =>
    `\\u${character.charCodeAt(0).toString(16).padStart(4, "0")}`,
  );
}

function hashWithout(value: ExecutionEvidencePayload, excludedField: string): string {
  const payload = Object.fromEntries(
    Object.entries(value).filter(([key]) => key !== excludedField),
  );
  return createHash("sha256")
    .update(canonicalJson(payload), "utf8")
    .digest("hex");
}

function requiredString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`invalid_execution_evidence:${field}`);
  }
  return value;
}

function requireEqual(field: string, left: unknown, right: unknown): void {
  if (left !== right) throw new Error(`execution_evidence_${field}_mismatch`);
}

export function verifyExecutionEvidence(
  receipt: ExecutionEvidencePayload,
  result: ExecutionEvidencePayload,
  attestation: ExecutionEvidencePayload,
): void {
  const receiptHash = requiredString(receipt.receipt_hash, "receipt_hash");
  const resultHash = requiredString(result.result_hash, "result_hash");
  const attestationHash = requiredString(attestation.attestation_hash, "attestation_hash");

  // Each Python evidence object excludes only its own top-level hash field.
  // Nested hash fields remain part of the canonical payload.
  if (hashWithout(receipt, "receipt_hash") !== receiptHash) throw new Error("receipt_hash_mismatch");
  if (hashWithout(result, "result_hash") !== resultHash) throw new Error("result_hash_mismatch");
  if (hashWithout(attestation, "attestation_hash") !== attestationHash) throw new Error("attestation_hash_mismatch");

  requireEqual("receipt_id", receipt.receipt_id, result.receipt_id);
  requireEqual("receipt_hash", receipt.receipt_hash, result.receipt_hash);
  requireEqual("receipt_id", receipt.receipt_id, attestation.receipt_id);
  requireEqual("receipt_hash", receipt.receipt_hash, attestation.receipt_hash);
  requireEqual("result_id", result.result_id, attestation.result_id);
  requireEqual("result_hash", result.result_hash, attestation.result_hash);

  for (const field of ["workload_id", "agent_id", "node_id", "pack_id", "runtime_kind"]) {
    requireEqual(field, result[field], receipt[field]);
    if (attestation[field] !== receipt[field]) {
      throw new Error(`attestation_${field}_mismatch`);
    }
  }
}
