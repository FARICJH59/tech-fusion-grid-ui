import type { ProofObligation, VerificationResult } from "../../hoare-contracts/src";

/** Provider-neutral proof response emitted by the HOARE-AGENT verifier boundary. */
export interface HoareAgentProofResponse {
  proofId: string;
  verified: boolean;
  proofDigest: string;
  verifier: string;
  verifierVersion?: string;
  reason?: string;
  verifiedAt?: string;
}

/**
 * Adapter input for a formal Hoare triple. Keeping this structural avoids a
 * compile-time dependency on the Python HOARE-AGENT implementation.
 */
export interface HoareAgentTriple {
  proofId: string;
  precondition: string;
  program: string;
  postcondition: string;
  stateDigest?: string;
  verifier?: string;
  verifierVersion?: string;
}

export function toProofObligation(triple: HoareAgentTriple): ProofObligation {
  return {
    proofId: triple.proofId,
    precondition: triple.precondition,
    program: triple.program,
    postcondition: triple.postcondition,
    stateDigest: triple.stateDigest,
    verifier: triple.verifier ?? "HOARE-AGENT",
    verifierVersion: triple.verifierVersion,
  };
}

export function toVerificationResult(
  response: HoareAgentProofResponse,
): VerificationResult {
  return {
    proofId: response.proofId,
    verified: response.verified,
    verifier: response.verifier,
    verifierVersion: response.verifierVersion,
    proofDigest: response.proofDigest,
    reason: response.reason,
    verifiedAt: response.verifiedAt ?? new Date().toISOString(),
  };
}
