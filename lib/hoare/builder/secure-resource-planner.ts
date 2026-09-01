import type { BuilderCapabilityPlan } from "./capability-planner";
import { evaluateSecurityPolicy, type CompiledSecurityPolicy } from "./security-policy";
import { planResources, type ResourcePlan, type ResourceTarget } from "./resource-planner";

export interface SecureResourcePlan extends ResourcePlan {
  security: ReturnType<typeof evaluateSecurityPolicy>;
}

export function planResourcesWithSecurity(
  capabilityPlan: BuilderCapabilityPlan,
  targets: readonly ResourceTarget[],
  policy: CompiledSecurityPolicy,
): SecureResourcePlan {
  const security = evaluateSecurityPolicy(policy, capabilityPlan.requirements);
  if (!security.allowed) {
    return {
      capabilityPlan,
      selected: null,
      candidates: [],
      status: "no_eligible_target",
      security,
    };
  }

  return { ...planResources(capabilityPlan, targets), security };
}
