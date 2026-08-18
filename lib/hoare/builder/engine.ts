import type { BuilderPlan, BuilderResourceKind } from "./types";

export type BuilderLifecycleAction = "approve" | "start" | "complete" | "fail";

export type BuilderExecutionRecord = {
  planId: string;
  action: BuilderLifecycleAction;
  status: BuilderPlan["status"];
  timestamp: string;
};

const transitions: Record<BuilderPlan["status"], Partial<Record<BuilderLifecycleAction, BuilderPlan["status"]>>> = {
  planned: { approve: "approved", fail: "failed" },
  approved: { start: "building", fail: "failed" },
  building: { complete: "ready", fail: "failed" },
  ready: {},
  failed: {},
};

export function validateBuilderPlan(plan: BuilderPlan): string[] {
  const errors: string[] = [];
  const names = new Set<string>();

  if (!plan.id) errors.push("plan.id is required");
  if (!plan.intent.tenantId) errors.push("intent.tenantId is required");
  if (!plan.intent.name) errors.push("intent.name is required");
  if (!plan.resources.length) errors.push("at least one resource is required");

  for (const resource of plan.resources) {
    if (names.has(resource.name)) errors.push(`duplicate resource: ${resource.name}`);
    names.add(resource.name);
  }

  const available = new Set(plan.resources.map((resource) => resource.name));
  for (const resource of plan.resources) {
    for (const dependency of resource.dependsOn) {
      if (!available.has(dependency)) {
        errors.push(`${resource.name} depends on missing resource ${dependency}`);
      }
    }
  }

  const index = new Map(plan.resources.map((resource, position) => [resource.name, position]));
  for (const resource of plan.resources) {
    for (const dependency of resource.dependsOn) {
      if ((index.get(dependency) ?? -1) >= (index.get(resource.name) ?? -1)) {
        errors.push(`${resource.name} must appear after dependency ${dependency}`);
      }
    }
  }

  return errors;
}

export function transitionBuilderPlan(
  plan: BuilderPlan,
  action: BuilderLifecycleAction,
): { plan: BuilderPlan; record: BuilderExecutionRecord } {
  const errors = validateBuilderPlan(plan);
  if (errors.length) throw new Error(`Invalid builder plan: ${errors.join("; ")}`);

  const nextStatus = transitions[plan.status][action];
  if (!nextStatus) {
    throw new Error(`Invalid builder transition: ${plan.status} -> ${action}`);
  }

  const nextPlan: BuilderPlan = { ...plan, status: nextStatus };
  return {
    plan: nextPlan,
    record: {
      planId: plan.id,
      action,
      status: nextStatus,
      timestamp: new Date().toISOString(),
    },
  };
}

export function resourceKinds(plan: BuilderPlan): BuilderResourceKind[] {
  return plan.resources.map((resource) => resource.kind);
}
