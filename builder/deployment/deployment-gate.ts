import { DeploymentAdapter, DeploymentRequest, DeploymentResult } from "./deployment-adapter";

export interface DeploymentEligibility {
  allowed: boolean;
  reason: string;
}

export function requireDeploymentEligibility(input: {
  simulationAllowed: boolean;
  attested: boolean;
  provenanceVerified: boolean;
}): DeploymentEligibility {
  if (!input.simulationAllowed) return { allowed: false, reason: "SIMULATION_DENIED" };
  if (!input.attested) return { allowed: false, reason: "ATTESTATION_REQUIRED" };
  if (!input.provenanceVerified) return { allowed: false, reason: "PROVENANCE_UNVERIFIED" };
  return { allowed: true, reason: "DEPLOYMENT_ELIGIBLE" };
}

export async function deployWithGate(
  adapter: DeploymentAdapter,
  request: DeploymentRequest,
  eligibility: DeploymentEligibility,
): Promise<DeploymentResult> {
  if (!eligibility.allowed) {
    return {
      unitId: request.unitId,
      target: request.target,
      accepted: false,
      message: eligibility.reason,
    };
  }
  return adapter.deploy(request);
}
