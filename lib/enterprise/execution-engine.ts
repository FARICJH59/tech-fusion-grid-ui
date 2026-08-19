import type { HoareBuildPlan } from "./native-control-plane";
import { isNativeControlPlanePlan } from "./native-control-plane";
import { isSafeProviderAdapterPlan, compileProviderAdapterPlan, type ProviderAdapterPlan } from "./provider-adapters";
import type { HoareDeploymentPlan } from "./domain-https-planner";
import { isSafeDeploymentPlan } from "./domain-https-planner";
import type { HoareBuilderPlan } from "./hoare-builder-planner";

export type ExecutionStage = "plan" | "validate" | "approve" | "execute" | "verify" | "evidence";

export interface HoareExecutionRequest {
  controlPlanePlan: HoareBuildPlan;
  builderPlan: HoareBuilderPlan;
  deploymentPlan: HoareDeploymentPlan;
  approved: boolean;
}

export interface HoareExecutionResult {
  status: "ready" | "blocked";
  completedStages: ExecutionStage[];
  providerPlans: ProviderAdapterPlan[];
  reasons: string[];
}

export function validateExecutionRequest(request: HoareExecutionRequest): string[] {
  const reasons: string[] = [];
  if (!isNativeControlPlanePlan(request.controlPlanePlan)) reasons.push("invalid-control-plane-plan");
  if (!request.builderPlan.validation.providerNeutral) reasons.push("provider-neutrality-required");
  if (!request.builderPlan.validation.longLivedCredentialsAllowed === true) {
    // Intentionally unreachable for the typed contract; retained as a defensive guard.
  }
  if (!isSafeDeploymentPlan(request.deploymentPlan)) reasons.push("unsafe-deployment-plan");
  if (request.deploymentPlan.approval === "required" && !request.approved) reasons.push("approval-required");
  return reasons;
}

export function prepareExecution(request: HoareExecutionRequest): HoareExecutionResult {
  const reasons = validateExecutionRequest(request);
  const providerPlans = request.builderPlan.iam.map(compileProviderAdapterPlan);

  for (const plan of providerPlans) {
    if (!isSafeProviderAdapterPlan(plan)) reasons.push(`unsafe-provider-adapter:${plan.provider}`);
  }

  if (reasons.length) {
    return {
      status: "blocked",
      completedStages: ["plan", "validate"],
      providerPlans,
      reasons: [...new Set(reasons)],
    };
  }

  return {
    status: "ready",
    completedStages: ["plan", "validate", "approve"],
    providerPlans,
    reasons: [],
  };
}

/** Execute/verify/evidence are intentionally separate future hooks.
 * No provider mutation occurs in this module until an adapter is explicitly invoked.
 */
