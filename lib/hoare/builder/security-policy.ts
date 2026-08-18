import type { BuilderRequirements } from "./capability-planner";

export type SecurityPolicySource = "aegisc" | "hoare";

export interface CompiledSecurityPolicy {
  version: "1";
  policyId: string;
  source: SecurityPolicySource;
  classification?: BuilderRequirements["security"]["classification"];
  allowedProviders?: readonly string[];
  allowedRegions?: readonly string[];
  egressAllowed?: boolean;
  dataResidency?: string;
  approvedAccelerators?: readonly string[];
  identityRequired: boolean;
  auditRequired: boolean;
  digest: string;
}

export interface SecurityPolicyEvaluation {
  allowed: boolean;
  reasons: string[];
}

/**
 * AEGISC is the policy language/compiler boundary; HOARE remains the runtime
 * control plane. This module consumes an already-compiled policy artifact and
 * never executes provider actions or grants authorization by itself.
 */
export function evaluateSecurityPolicy(
  policy: CompiledSecurityPolicy,
  requirements: BuilderRequirements,
): SecurityPolicyEvaluation {
  const reasons: string[] = [];
  const security = requirements.security;

  if (policy.classification && security?.classification && policy.classification !== security.classification) {
    reasons.push("classification_policy_mismatch");
  }
  if (policy.allowedProviders?.length && security?.allowedProviders?.some((provider) => !policy.allowedProviders!.includes(provider))) {
    reasons.push("provider_outside_aegisc_policy");
  }
  if (policy.allowedRegions?.length && security?.allowedRegions?.some((region) => !policy.allowedRegions!.includes(region))) {
    reasons.push("region_outside_aegisc_policy");
  }
  if (policy.egressAllowed !== undefined && security?.egressAllowed !== undefined && policy.egressAllowed !== security.egressAllowed) {
    reasons.push("egress_policy_mismatch");
  }
  if (policy.approvedAccelerators?.length && requirements.compute?.acceleratorModel && !policy.approvedAccelerators.includes(requirements.compute.acceleratorModel)) {
    reasons.push("accelerator_not_approved");
  }

  return { allowed: reasons.length === 0, reasons };
}
