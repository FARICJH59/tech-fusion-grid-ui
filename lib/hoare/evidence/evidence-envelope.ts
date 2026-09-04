import { createHash } from "node:crypto";
import type { EvidenceEnvelope, ExecutionAttestation, ExecutionReceipt, ExecutionResult } from "@/packages/hoare-contracts/src";

export interface EvidenceEnvelopeInput {
  tenantId: string;
  organizationId?: string;
  projectId?: string;
  missionId?: string;
  transactionId: string;
  attemptId: string;
  executionId: string;
  artifactDigest?: string;
  releaseDigest?: string;
  pasorPlanHash?: string;
  pasorUnitId?: string;
  receipt: ExecutionReceipt;
  result: ExecutionResult;
  attestation: ExecutionAttestation;
  intendedStateDigest?: string;
  observedStateDigest?: string;
  producerIdentity: string;
  runtimeIdentity: string;
  nodeIdentity?: string;
  startedAt: string;
  completedAt?: string;
}

function canonicalize(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
  return `{${Object.keys(value as Record<string, unknown>).sort().map((key) => `${JSON.stringify(key)}:${canonicalize((value as Record<string, unknown>)[key])}`).join(",")}}`;
}

export function createEvidenceEnvelope(input: EvidenceEnvelopeInput): EvidenceEnvelope {
  const material = canonicalize(input);
  const evidenceDigest = createHash("sha256").update(material, "utf8").digest("hex");
  const evidenceId = `evidence_${evidenceDigest.slice(0, 24)}`;
  return {
    ...input,
    evidenceId,
    evidenceDigest,
    integrity: "VALID",
  };
}
