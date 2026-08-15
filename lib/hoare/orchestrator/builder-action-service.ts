import type { BuilderPlan } from "@/lib/hoare/builder/types";
import type { BuilderExecutor, BuildResult } from "@/lib/hoare/builder/executor";
import type { BuilderPlanRepository } from "@/lib/hoare/builder/plan-repository";

export class HoareBuilderActionService {
  constructor(
    private readonly plans: BuilderPlanRepository,
    private readonly executor: BuilderExecutor,
  ) {}

  async build(planId: string, tenantId: string): Promise<BuildResult> {
    const plan = await this.requirePlan(planId, tenantId);
    if (plan.status !== "approved" && plan.status !== "building") {
      throw new Error(`Plan ${planId} must be approved before an agent can build it; received ${plan.status}`);
    }

    const building = { ...plan, status: "building" as const };
    await this.plans.save(building);

    try {
      const result = await this.executor.execute(building);
      await this.plans.save({ ...building, status: "ready" });
      return result;
    } catch (error) {
      await this.plans.save({ ...building, status: "failed" });
      throw error;
    }
  }

  async remediate(planId: string, tenantId: string): Promise<BuildResult> {
    return this.build(planId, tenantId);
  }

  private async requirePlan(planId: string, tenantId: string): Promise<BuilderPlan> {
    const plan = await this.plans.get(planId, tenantId);
    if (!plan) throw new Error(`Builder plan ${planId} was not found for tenant ${tenantId}`);
    return plan;
  }
}
