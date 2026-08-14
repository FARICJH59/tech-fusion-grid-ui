export interface ReleaseGateInput {
  ciPassed: boolean;
  simulationAllowed: boolean;
  attestationVerified: boolean;
  provenanceVerified: boolean;
  deploymentVerified: boolean;
  governanceAllowed: boolean;
}

export interface ReleaseGateResult {
  releasable: boolean;
  reason: string;
}

export function evaluateReleaseGate(input: ReleaseGateInput): ReleaseGateResult {
  if (!input.ciPassed) return { releasable: false, reason: "CI_FAILED" };
  if (!input.simulationAllowed) return { releasable: false, reason: "SIMULATION_DENIED" };
  if (!input.governanceAllowed) return { releasable: false, reason: "GOVERNANCE_DENIED" };
  if (!input.attestationVerified) return { releasable: false, reason: "ATTESTATION_UNVERIFIED" };
  if (!input.provenanceVerified) return { releasable: false, reason: "PROVENANCE_UNVERIFIED" };
  if (!input.deploymentVerified) return { releasable: false, reason: "DEPLOYMENT_UNVERIFIED" };
  return { releasable: true, reason: "RELEASE_ELIGIBLE" };
}
