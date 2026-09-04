import { createEvidenceEnvelope } from "./evidence-envelope";
import type { EvidenceEnvelope, EvidenceEnvelopeInput } from "./evidence-envelope";
import type { EvidenceEnvelope as CanonicalEvidenceEnvelope } from "@/packages/hoare-contracts/src";

export interface EvidenceVerificationResult {
  verified: boolean;
  evidenceDigest: string;
  reasons: string[];
}

export function verifyEvidence(input: EvidenceEnvelopeInput, envelope: EvidenceEnvelope | CanonicalEvidenceEnvelope): EvidenceVerificationResult {
  const reasons: string[] = [];
  const recomputed = createEvidenceEnvelope(input);
  if (recomputed.evidenceDigest !== envelope.evidenceDigest) reasons.push("evidence_digest_mismatch");
  if (recomputed.transactionId !== envelope.transactionId) reasons.push("transaction_id_mismatch");
  if (recomputed.attemptId !== envelope.attemptId) reasons.push("attempt_id_mismatch");
  return { verified: reasons.length === 0, evidenceDigest: envelope.evidenceDigest, reasons };
}
