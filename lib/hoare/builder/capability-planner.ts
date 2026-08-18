import type { BuilderPlan } from "./types";

export type SecurityClassification = "unclassified" | "controlled" | "classified";
export type AcceleratorKind = "none" | "gpu" | "npu" | "tpu";

export interface BuilderRequirements {
  security?: {
    classification?: SecurityClassification;
    allowedRegions?: readonly string[];
    allowedProviders?: readonly string[];
    egressAllowed?: boolean;
  };
  compute?: {
    accelerator?: AcceleratorKind;
    acceleratorModel?: string;
    minAccelerators?: number;
    minCpu?: number;
    minMemoryGiB?: number;
  };
  serviceLevel?: {
    minAvailability?: number;
    maxLatencyMs?: number;
    minReplicas?: number;
    maxCostPerHour?: number;
  };
}

export interface NormalizedBuilderRequirements {
  security: {
    classification: SecurityClassification;
    allowedRegions: string[];
    allowedProviders: string[];
    egressAllowed: boolean;
  };
  compute: {
    accelerator: AcceleratorKind;
    acceleratorModel: string;
    minAccelerators: number;
    minCpu: number;
    minMemoryGiB: number;
  };
  serviceLevel: {
    minAvailability: number;
    maxLatencyMs: number;
    minReplicas: number;
    maxCostPerHour: number;
  };
}

export interface BuilderCapabilityPlan {
  plan: BuilderPlan;
  requirements: NormalizedBuilderRequirements;
  constraints: string[];
}

function assertFiniteNonNegative(value: number | undefined, name: string): void {
  if (value !== undefined && (!Number.isFinite(value) || value < 0)) {
    throw new Error(`INVALID_BUILDER_REQUIREMENT:${name}`);
  }
}

function normalizeRequirements(input: BuilderRequirements): NormalizedBuilderRequirements {
  const security = {
    classification: input.security?.classification ?? "unclassified",
    allowedRegions: [...(input.security?.allowedRegions ?? [])],
    allowedProviders: [...(input.security?.allowedProviders ?? [])],
    egressAllowed: input.security?.egressAllowed ?? true,
  };
  const compute = {
    accelerator: input.compute?.accelerator ?? "none",
    acceleratorModel: input.compute?.acceleratorModel ?? "",
    minAccelerators: input.compute?.minAccelerators ?? 0,
    minCpu: input.compute?.minCpu ?? 0,
    minMemoryGiB: input.compute?.minMemoryGiB ?? 0,
  };
  const serviceLevel = {
    minAvailability: input.serviceLevel?.minAvailability ?? 0,
    maxLatencyMs: input.serviceLevel?.maxLatencyMs ?? 0,
    minReplicas: input.serviceLevel?.minReplicas ?? 1,
    maxCostPerHour: input.serviceLevel?.maxCostPerHour ?? 0,
  };

  if (security.classification === "classified" && security.egressAllowed) {
    throw new Error("CLASSIFIED_BUILDER_PLAN_CANNOT_ALLOW_EGRESS");
  }
  if (compute.accelerator === "none" && compute.acceleratorModel) {
    throw new Error("INVALID_BUILDER_REQUIREMENT:acceleratorModel");
  }
  assertFiniteNonNegative(compute.minAccelerators, "minAccelerators");
  assertFiniteNonNegative(compute.minCpu, "minCpu");
  assertFiniteNonNegative(compute.minMemoryGiB, "minMemoryGiB");
  assertFiniteNonNegative(serviceLevel.maxLatencyMs, "maxLatencyMs");
  assertFiniteNonNegative(serviceLevel.minReplicas, "minReplicas");
  assertFiniteNonNegative(serviceLevel.maxCostPerHour, "maxCostPerHour");
  if (serviceLevel.minAvailability < 0 || serviceLevel.minAvailability > 1) {
    throw new Error("INVALID_BUILDER_REQUIREMENT:minAvailability");
  }

  return { security, compute, serviceLevel };
}

export function buildCapabilityPlan(
  plan: BuilderPlan,
  requirements: BuilderRequirements = {},
): BuilderCapabilityPlan {
  const normalized = normalizeRequirements(requirements);
  const constraints: string[] = [
    `classification:${normalized.security.classification}`,
    `egress:${normalized.security.egressAllowed ? "allowed" : "blocked"}`,
  ];

  if (normalized.security.allowedProviders.length) constraints.push(`providers:${normalized.security.allowedProviders.join(",")}`);
  if (normalized.security.allowedRegions.length) constraints.push(`regions:${normalized.security.allowedRegions.join(",")}`);
  if (normalized.compute.accelerator !== "none") constraints.push(`accelerator:${normalized.compute.accelerator}`);
  if (normalized.compute.acceleratorModel) constraints.push(`acceleratorModel:${normalized.compute.acceleratorModel}`);
  if (normalized.compute.minAccelerators > 0) constraints.push(`minAccelerators:${normalized.compute.minAccelerators}`);
  if (normalized.compute.minCpu > 0) constraints.push(`minCpu:${normalized.compute.minCpu}`);
  if (normalized.compute.minMemoryGiB > 0) constraints.push(`minMemoryGiB:${normalized.compute.minMemoryGiB}`);
  if (normalized.serviceLevel.minReplicas > 1) constraints.push(`minReplicas:${normalized.serviceLevel.minReplicas}`);
  if (normalized.serviceLevel.maxLatencyMs > 0) constraints.push(`maxLatencyMs:${normalized.serviceLevel.maxLatencyMs}`);
  if (normalized.serviceLevel.minAvailability > 0) constraints.push(`minAvailability:${normalized.serviceLevel.minAvailability}`);
  if (normalized.serviceLevel.maxCostPerHour > 0) constraints.push(`maxCostPerHour:${normalized.serviceLevel.maxCostPerHour}`);

  return { plan, requirements: normalized, constraints };
}
