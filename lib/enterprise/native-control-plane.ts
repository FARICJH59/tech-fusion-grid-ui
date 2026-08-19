/**
 * Canonical contract for the native HOARE control plane.
 *
 * This layer owns intent, policy, identity, orchestration, evidence and
 * provider-neutral execution decisions. Cloud vendors are adapters, not
 * control-plane dependencies.
 */

export const HOARE_CONTROL_PLANE_VERSION = "1.0.0" as const;

export const HOARE_CONTROL_PLANE_LAYERS = [
  "identity",
  "tenant",
  "policy",
  "intent",
  "architecture",
  "model-selection",
  "agent-runtime",
  "infrastructure",
  "provider-adapters",
  "domain-https",
  "deployment",
  "observability",
  "security",
  "evidence",
  "billing",
  "marketplace",
  "edge",
] as const;

export type HoareControlPlaneLayer =
  (typeof HOARE_CONTROL_PLANE_LAYERS)[number];

export type HoareProvider = "aws" | "gcp" | "azure" | "edge" | "bare-metal";

export interface HoareBuildIntent {
  tenantId: string;
  projectId: string;
  description: string;
  environment: "development" | "staging" | "production";
  providers?: HoareProvider[];
  domain?: string;
  autonomy?: "manual" | "approval" | "policy-autonomous";
}

export interface HoareBuildPlan {
  schema: "hoare.build-plan/v1";
  intent: HoareBuildIntent;
  layers: HoareControlPlaneLayer[];
  providerAdapters: HoareProvider[];
  requiresApproval: boolean;
  executionContract: "plan-validate-approve-execute-verify";
}

export function createBuildPlan(intent: HoareBuildIntent): HoareBuildPlan {
  const providers = intent.providers?.length ? [...intent.providers] : ["edge"];
  const requiresApproval =
    intent.autonomy !== "policy-autonomous" || intent.environment === "production";

  return {
    schema: "hoare.build-plan/v1",
    intent,
    layers: [...HOARE_CONTROL_PLANE_LAYERS],
    providerAdapters: providers,
    requiresApproval,
    executionContract: "plan-validate-approve-execute-verify",
  };
}

export function isNativeControlPlanePlan(plan: HoareBuildPlan): boolean {
  return (
    plan.schema === "hoare.build-plan/v1" &&
    plan.executionContract === "plan-validate-approve-execute-verify" &&
    plan.layers.includes("provider-adapters") &&
    plan.layers.includes("policy") &&
    plan.layers.includes("identity")
  );
}
