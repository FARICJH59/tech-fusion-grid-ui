import type { BuilderPlan } from "./types";

export interface BuilderPlanRepository {
  get(planId: string, tenantId: string): Promise<BuilderPlan | null>;
  save(plan: BuilderPlan): Promise<void>;
}

/** Explicit persistence seam. Replace the backing map with the production DB adapter at composition time. */
export class InMemoryBuilderPlanRepository implements BuilderPlanRepository {
  private readonly plans = new Map<string, BuilderPlan>();

  async get(planId: string, tenantId: string): Promise<BuilderPlan | null> {
    const plan = this.plans.get(planId);
    if (!plan || plan.intent.tenantId !== tenantId) return null;
    return structuredClone(plan);
  }

  async save(plan: BuilderPlan): Promise<void> {
    this.plans.set(plan.id, structuredClone(plan));
  }
}
