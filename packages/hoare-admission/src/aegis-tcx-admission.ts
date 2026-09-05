import type {
  AuthorizationDecision,
  AuthorizationRequest,
  ProofObligation,
  TCXAdmission,
  TCXTransaction,
  VerificationResult,
} from "../../hoare-contracts/src/index";

export type AdmissionInput = {
  authorizationRequest: AuthorizationRequest;
  authorizationDecision: AuthorizationDecision;
  proofObligation: ProofObligation;
  verificationResult: VerificationResult;
  transaction: TCXTransaction;
  leaseId: string;
  fenceValid: boolean;
  admittedAt?: string;
};

export type AdmissionResult = {
  admitted: boolean;
  admission: TCXAdmission;
  reason: string;
};

/**
 * A pure AEGIS -> TCX admission gate.
 *
 * This layer makes authority, proof, transaction identity, state-version,
 * lease, and fence checks explicit before AgentFusion receives execution
 * authority. It has no side effects and therefore can be tested independently
 * of cloud providers, databases, MQTT, or the runtime executor.
 */
export function admitGovernedExecution(input: AdmissionInput): AdmissionResult {
  const now = input.admittedAt ?? new Date().toISOString();
  const { authorizationRequest: request, authorizationDecision: auth } = input;
  const { proofObligation: proof, verificationResult: verification, transaction: tx } = input;

  const failures: string[] = [];

  if (request.tenantId !== tx.tenantId) failures.push("tenant_mismatch");
  if (request.agentId !== (tx.agentId ?? request.agentId)) failures.push("agent_mismatch");
  if (request.runtimeCapabilityId.length === 0) failures.push("runtime_capability_missing");
  if (request.requestedAction.length === 0) failures.push("requested_action_missing");
  if (auth.requestId !== request.requestId) failures.push("authorization_request_mismatch");
  if (!auth.allowed || auth.decision !== "ALLOW") failures.push("authorization_denied");
  if (verification.proofId !== proof.proofId) failures.push("proof_result_mismatch");
  if (!verification.verified) failures.push("proof_not_verified");
  if (tx.expectedStateVersion !== tx.stateVersion) failures.push("state_version_mismatch");
  if (!input.leaseId || input.leaseId !== tx.leaseId) failures.push("lease_mismatch");
  if (!input.fenceValid) failures.push("fence_invalid");
  if (!tx.idempotencyKey) failures.push("idempotency_key_missing");

  const admitted = failures.length === 0;
  const reason = admitted ? "AEGIS authorization and proof accepted by TCX admission gate." : `Admission blocked: ${failures.join(", ")}`;

  return {
    admitted,
    reason,
    admission: {
      transactionId: tx.transactionId,
      attemptId: tx.attemptId,
      admitted,
      stateVersion: tx.stateVersion,
      leaseId: input.leaseId,
      fenceValid: input.fenceValid,
      authorizationDecisionId: auth.decisionId,
      verificationProofId: verification.proofId,
      admittedAt: now,
      reason,
    },
  };
}
