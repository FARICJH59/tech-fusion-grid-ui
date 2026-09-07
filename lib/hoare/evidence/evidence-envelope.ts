import { sha256Canonical } from "@/packages/hoare-contracts/src";
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

export function createEvidenceEnvelope(input: EvidenceEnvelopeInput): EvidenceEnvelope {
  const evidenceDigest = sha256Canonical(input);
  const evidenceId = `evidence_${evidenceDigest.slice(0, 24)}`;
  return {
    ...input,
    evidenceId,
    evidenceDigest,
    integrity: "VALID",
  };
}
