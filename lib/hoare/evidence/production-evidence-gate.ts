import type { EvidenceEnvelope, EvidenceVerificationResult, ExecutionAttestation, ExecutionReceipt, ExecutionResult, ReconciliationResult } from "@/packages/hoare-contracts/src";
import { createEvidenceEnvelope } from "./evidence-envelope";
import { verifyExecutionEvidence } from "../execution/evidence-verifier";
import { reconcileEvidence } from "../reconciliation/reconcile";

export interface ProductionEvidenceInput {
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
  producerIdentity: string;
  runtimeIdentity: string;
  nodeIdentity?: string;
}

export interface ProductionEvidenceOutcome {
  evidence: EvidenceEnvelope;
  evidenceVerification: EvidenceVerificationResult;
  reconciliation: ReconciliationResult;
}

export function processProductionEvidence(input: ProductionEvidenceInput): ProductionEvidenceOutcome {
  const evidenceVerification = verifyExecutionEvidence(input.receipt, input.result, input.attestation);
  const evidence = createEvidenceEnvelope({
    tenantId: input.tenantId,
    organizationId: input.organizationId,
    projectId: input.projectId,
    missionId: input.missionId,
    transactionId: input.transactionId,
    attemptId: input.attemptId,
    executionId: input.executionId,
    artifactDigest: input.artifactDigest,
    releaseDigest: input.releaseDigest,
    pasorPlanHash: input.pasorPlanHash,
    pasorUnitId: input.pasorUnitId,
    receipt: input.receipt,
    result: input.result,
    attestation: input.attestation,
    intendedStateDigest: input.intendedStateDigest,
    observedStateDigest: input.result.observedStateDigest,
    producerIdentity: input.producerIdentity,
    runtimeIdentity: input.runtimeIdentity,
    nodeIdentity: input.nodeIdentity,
    startedAt: input.result.startedAt,
    completedAt: input.result.completedAt,
  });

  const reconciliation = reconcileEvidence(evidence);
  return {
    evidence: { ...evidence, integrity: evidenceVerification.verified ? "VALID" : "INVALID" },
    evidenceVerification: { ...evidenceVerification, evidenceId: evidence.evidenceId },
    reconciliation,
  };
}
