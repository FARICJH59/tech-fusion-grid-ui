import type { BuilderPlan } from "@/lib/hoare/builder/types";
import type { BuilderExecutor, BuildResult } from "@/lib/hoare/builder/executor";

export interface BuilderPlanStore {
  get(planId: string): Promise<BuilderPlan | null>;
  save(plan: BuilderPlan): Promise<void>;
}

export class HoareBuilderActionService {
  constructor(
    private readonly plans: BuilderPlanStore,
    private readonly executor: BuilderExecutor,
  ) {}

  async build(planId: string): Promise<BuildResult> {
    const plan = await this.requirePlan(planId);
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

  async remediate(planId: string): Promise<BuildResult> {
    // Remediation must use the same governed Builder execution boundary.
    return this.build(planId);
  }

  private async requirePlan(planId: string): Promise<BuilderPlan> {
    const plan = await this.plans.get(planId);
    if (!plan) throw new Error(`Builder plan ${planId} was not found`);
    return plan;
  }
}
