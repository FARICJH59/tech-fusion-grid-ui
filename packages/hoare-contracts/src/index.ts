/**
 * HOARE canonical cross-subsystem contracts.
 *
 * These contracts deliberately separate capability, authority, proof,
 * transaction admission, execution evidence, reconciliation, and commit.
 * Implementations remain free to evolve behind these boundaries.
 */

export * from "./canonical-serialization";

export type Decision = "ALLOW" | "DENY" | "BLOCK";
export type Severity = "INFO" | "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export interface IntelligenceCapability {
  id: string;
  name: string;
  description: string;
  category: string;
  version?: string;
  provenance?: string;
  metadata?: Record<string, unknown>;
}

export interface RuntimeCapability {
  id: string;
  provider: string;
  action: string;
  resourceKinds: string[];
  version?: string;
  constraints?: Record<string, unknown>;
}

export interface AuthorizationRequest {
  requestId: string;
  tenantId: string;
  organizationId?: string;
  projectId?: string;
  identity: string;
  agentId: string;
  runtimeCapabilityId: string;
  requestedAction: string;
  resource: string;
  policyContext?: Record<string, unknown>;
  riskContext?: Record<string, unknown>;
  approvalContext?: Record<string, unknown>;
}

export interface AuthorizationDecision {
  decisionId: string;
  requestId: string;
  decision: Decision;
  allowed: boolean;
  policyVersion: string;
  constraints?: Record<string, unknown>;
  requiredApprovals?: string[];
  reason: string;
  decidedAt: string;
}

export interface ProofObligation {
  proofId: string;
  precondition: string;
  program: string;
  postcondition: string;
  stateDigest?: string;
  verifier: string;
  verifierVersion?: string;
}

export interface VerificationResult {
  proofId: string;
  verified: boolean;
  verifier: string;
  verifierVersion?: string;
  proofDigest: string;
  reason?: string;
  verifiedAt: string;
}

export interface BuilderPlan {
  planId: string;
  tenantId: string;
  projectId?: string;
  resources: Array<{
    resourceId: string;
    kind: string;
    provider: string;
    action: string;
    dependencies: string[];
  }>;
  planDigest: string;
  status: "planned" | "building" | "completed" | "failed";
}

export interface TCXTransaction {
  transactionId: string;
  attemptId: string;
  tenantId: string;
  projectId?: string;
  agentId?: string;
  artifactDigest?: string;
  releaseDigest?: string;
  pasorPlanHash?: string;
  pasorUnitId?: string;
  workloadId?: string;
  nodeId?: string;
  packId?: string;
  runtimeKind?: string;
  channelId?: string;
  leaseId?: string;
  expectedStateVersion: number;
  stateVersion: number;
  idempotencyKey: string;
  preconditionHash?: string;
  provenanceHash?: string;
  state: string;
}

export interface TCXAdmission {
  transactionId: string;
  attemptId: string;
  admitted: boolean;
  stateVersion: number;
  leaseId: string;
  fenceValid: boolean;
  authorizationDecisionId: string;
  verificationProofId: string;
  admittedAt: string;
  reason?: string;
}

export interface GovernedExecution {
  transactionId: string;
  attemptId: string;
  executionId: string;
  admission: TCXAdmission;
  leaseId: string;
  idempotencyKey: string;
}

export interface ExecutionReceipt {
  receiptId: string;
  receiptHash: string;
  transactionId: string;
  attemptId: string;
  admissionStatus: "ADMITTED" | "REJECTED";
  artifactDigest?: string;
  releaseDigest?: string;
  pasorPlanHash?: string;
  pasorUnitId?: string;
  producerIdentity: string;
  createdAt: string;
}

export interface ExecutionResult {
  resultId: string;
  resultHash: string;
  transactionId: string;
  attemptId: string;
  executionId: string;
  status: "completed" | "failed" | "timeout" | "cancelled";
  outputDigest?: string;
  observedStateDigest?: string;
  startedAt: string;
  completedAt?: string;
  error?: string;
}

export interface ExecutionAttestation {
  attestationId: string;
  attestationHash: string;
  transactionId: string;
  attemptId: string;
  executionId: string;
  verifierIdentity: string;
  verified: boolean;
  evidenceDigest: string;
  attestedAt: string;
  reason?: string;
}

export interface EvidenceEnvelope {
  evidenceId: string;
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
  evidenceDigest: string;
  producerIdentity: string;
  runtimeIdentity: string;
  nodeIdentity?: string;
  startedAt: string;
  completedAt?: string;
  integrity: "VALID" | "INVALID" | "UNKNOWN";
}

export interface EvidenceVerificationResult {
  evidenceId: string;
  verified: boolean;
  transactionId: string;
  attemptId: string;
  verifiedDigests: string[];
  discrepancies: string[];
  reason?: string;
  verifiedAt: string;
}

export interface ReconciliationResult {
  reconciliationId: string;
  transactionId: string;
  attemptId: string;
  matched: boolean;
  intendedStateDigest: string;
  observedStateDigest: string;
  evidenceDigest: string;
  discrepancies: Array<{
    field: string;
    expected: unknown;
    observed: unknown;
    severity: Severity;
  }>;
  severity: Severity;
  recoverable: boolean;
  recommendedAction: "COMMIT" | "REPAIR" | "ROLLBACK" | "BLOCK";
  reconciledAt: string;
}

export interface CommitFinalization {
  commitId: string;
  transactionId: string;
  attemptId: string;
  expectedStateVersion: number;
  evidenceDigest: string;
  reconciliationDigest: string;
  resultingStateDigest: string;
  commitRecordHash: string;
  finalizedAt: string;
  finalizationAuthority: string;
}

export interface GovernedExecutionDecision {
  intelligenceAllowed: boolean;
  runtimeAllowed: boolean;
  authorizationAllowed: boolean;
  policyAllowed: boolean;
  proofAllowed: boolean;
  tcxAdmitted: boolean;
  fenceValid: boolean;
  decision: Decision;
  reason: string;
}

export function canExecute(decision: GovernedExecutionDecision): boolean {
  return decision.intelligenceAllowed &&
    decision.runtimeAllowed &&
    decision.authorizationAllowed &&
    decision.policyAllowed &&
    decision.proofAllowed &&
    decision.tcxAdmitted &&
    decision.fenceValid;
}

export function canCommit(
  executionCompleted: boolean,
  evidenceVerified: boolean,
  reconciliation: ReconciliationResult,
  stateVersionValid: boolean,
  finalizationAuthorized: boolean,
): boolean {
  return executionCompleted && evidenceVerified && reconciliation.matched &&
    stateVersionValid && finalizationAuthorized;
}
