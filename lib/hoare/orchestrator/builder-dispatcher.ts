import type { BuilderPlan } from "@/lib/hoare/builder/types";
import type { AgentLoopState, OrchestratorDecision } from "./agent-loop";
import type { HoareActionDispatcher } from "./action-dispatcher";

export interface HoareBuilderActionService {
  build(plan: BuilderPlan): Promise<{ success: boolean; detail: string }>;
  remediate(input: { plan: BuilderPlan; reason: string }): Promise<{ success: boolean; detail: string }>;
}

export interface BuilderPlanResolver {
  resolve(context: AgentLoopState): Promise<BuilderPlan | null>;
}

export class BuilderActionDispatcher implements HoareActionDispatcher {
  constructor(
    private readonly plans: BuilderPlanResolver,
    private readonly builder: HoareBuilderActionService,
  ) {}

  async build(input: { context: AgentLoopState; decision: OrchestratorDecision }) {
    const plan = await this.requirePlan(input.context);
    if (plan.status !== "approved") {
      return { success: false, detail: `Builder plan ${plan.id} is not approved; received ${plan.status}` };
    }
    return this.builder.build(plan);
  }

  async remediate(input: { context: AgentLoopState; decision: OrchestratorDecision }) {
    const plan = await this.requirePlan(input.context);
    return this.builder.remediate({ plan, reason: input.decision.reason });
  }

  private async requirePlan(context: AgentLoopState): Promise<BuilderPlan> {
    const plan = await this.plans.resolve(context);
    if (!plan) throw new Error("No Builder plan is associated with this orchestration cycle");
    return plan;
  }
}
