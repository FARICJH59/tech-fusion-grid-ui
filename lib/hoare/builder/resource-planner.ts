import type { BuilderCapabilityPlan, BuilderRequirements } from "./capability-planner";

export interface ResourceTarget {
  id: string;
  provider: string;
  region: string;
  environment: "development" | "staging" | "production";
  classification: "unclassified" | "controlled" | "classified";
  egressAllowed: boolean;
  accelerator: "none" | "gpu" | "npu" | "tpu";
  acceleratorModels: readonly string[];
  acceleratorCount: number;
  cpu: number;
  memoryGiB: number;
  availability: number;
  estimatedLatencyMs: number;
  estimatedCostPerHour: number;
}

export interface ResourceCandidate {
  target: ResourceTarget;
  eligible: boolean;
  reasons: string[];
  score: number;
}

export interface ResourcePlan {
  capabilityPlan: BuilderCapabilityPlan;
  selected: ResourceTarget | null;
  candidates: ResourceCandidate[];
  status: "selected" | "no_eligible_target";
}

function matchesRequirements(target: ResourceTarget, requirements: BuilderRequirements): string[] {
  const reasons: string[] = [];
  const security = requirements.security;
  const compute = requirements.compute;
  const service = requirements.serviceLevel;

  if (security?.allowedProviders?.length && !security.allowedProviders.includes(target.provider)) {
    reasons.push("provider_not_allowed");
  }
  if (security?.allowedRegions?.length && !security.allowedRegions.includes(target.region)) {
    reasons.push("region_not_allowed");
  }
  if (security?.classification && target.classification !== security.classification) {
    reasons.push("classification_mismatch");
  }
  if (security?.classification === "classified" && target.egressAllowed) {
    reasons.push("classified_target_allows_egress");
  }
  if (security?.egressAllowed !== undefined && target.egressAllowed !== security.egressAllowed) {
    reasons.push("egress_policy_mismatch");
  }
  if (compute?.accelerator && target.accelerator !== compute.accelerator) {
    reasons.push("accelerator_type_mismatch");
  }
  if (compute?.acceleratorModel && !target.acceleratorModels.includes(compute.acceleratorModel)) {
    reasons.push("accelerator_model_unavailable");
  }
  if (compute?.minAccelerators !== undefined && target.acceleratorCount < compute.minAccelerators) {
    reasons.push("insufficient_accelerators");
  }
  if (compute?.minCpu !== undefined && target.cpu < compute.minCpu) {
    reasons.push("insufficient_cpu");
  }
  if (compute?.minMemoryGiB !== undefined && target.memoryGiB < compute.minMemoryGiB) {
    reasons.push("insufficient_memory");
  }
  if (service?.minAvailability !== undefined && target.availability < service.minAvailability) {
    reasons.push("availability_slo_not_met");
  }
  if (service?.maxLatencyMs && target.estimatedLatencyMs > service.maxLatencyMs) {
    reasons.push("latency_slo_not_met");
  }
  if (service?.maxCostPerHour && target.estimatedCostPerHour > service.maxCostPerHour) {
    reasons.push("cost_ceiling_exceeded");
  }
  return reasons;
}

function scoreTarget(target: ResourceTarget, requirements: BuilderRequirements): number {
  const service = requirements.serviceLevel;
  const cost = service?.maxCostPerHour;
  const latency = service?.maxLatencyMs;
  let score = 100;
  if (cost) score += Math.max(0, cost - target.estimatedCostPerHour) * 2;
  if (latency) score += Math.max(0, latency - target.estimatedLatencyMs);
  score += target.availability * 100;
  return score;
}

export function planResources(capabilityPlan: BuilderCapabilityPlan, targets: readonly ResourceTarget[]): ResourcePlan {
  const candidates = targets.map((target) => {
    const reasons = matchesRequirements(target, capabilityPlan.requirements);
    return {
      target,
      eligible: reasons.length === 0,
      reasons,
      score: reasons.length === 0 ? scoreTarget(target, capabilityPlan.requirements) : 0,
    };
  });

  const selected = candidates.filter((candidate) => candidate.eligible).sort((a, b) => b.score - a.score)[0]?.target ?? null;
  return {
    capabilityPlan,
    selected,
    candidates,
    status: selected ? "selected" : "no_eligible_target",
  };
}
