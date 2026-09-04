import { createHash } from "node:crypto";

export interface EvidenceEnvelopeInput {
  transactionId: string;
  attemptId: string;
  receipt: unknown;
  result: unknown;
  attestation: unknown;
  intendedStateDigest: string;
  observedStateDigest: string;
}

export interface EvidenceEnvelope {
  evidenceId: string;
  transactionId: string;
  attemptId: string;
  receipt: unknown;
  result: unknown;
  attestation: unknown;
  intendedStateDigest: string;
  observedStateDigest: string;
  evidenceDigest: string;
}

function canonicalize(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
  return `{${Object.keys(value as Record<string, unknown>).sort().map((key) => `${JSON.stringify(key)}:${canonicalize((value as Record<string, unknown>)[key])}`).join(",")}}`;
}

export function createEvidenceEnvelope(input: EvidenceEnvelopeInput): EvidenceEnvelope {
  const material = canonicalize({
    transactionId: input.transactionId,
    attemptId: input.attemptId,
    receipt: input.receipt,
    result: input.result,
    attestation: input.attestation,
    intendedStateDigest: input.intendedStateDigest,
    observedStateDigest: input.observedStateDigest,
  });
  const evidenceDigest = createHash("sha256").update(material).digest("hex");
  const evidenceId = `evidence_${evidenceDigest.slice(0, 24)}`;
  return { ...input, evidenceId, evidenceDigest };
}
