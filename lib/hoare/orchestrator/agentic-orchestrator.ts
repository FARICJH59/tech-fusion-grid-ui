import type { BuilderIntent, BuilderPlan } from "@/lib/hoare/builder/types";
import { planBuilderIntent } from "@/lib/hoare/builder/planner";
import { evaluateBuilderPolicy, type BuilderPolicy } from "@/lib/hoare/builder/policy";
import { transitionBuilderPlan } from "@/lib/hoare/builder/engine";
import type { BuilderExecutor, BuildResult } from "@/lib/hoare/builder/executor";

export type OrchestratorPhase =
  | "observe"
  | "plan"
  | "govern"
  | "approve"
  | "execute"
  | "verify"
  | "complete"
  | "blocked";

export type AgentDecision = {
  action: "build" | "block";
  reason: string;
  confidence?: number;
};

export type OrchestrationContext = {
  intent: BuilderIntent;
  provider?: string;
  environment?: BuilderPlan["deployment"]["environment"];
  policy?: BuilderPolicy;
};

export type OrchestrationResult = {
  phase: OrchestratorPhase;
  decision: AgentDecision;
  plan: BuilderPlan;
  violations: string[];
  execution?: BuildResult;
};

export interface OrchestratorAgent {
  decide(input: { intent: BuilderIntent; plan: BuilderPlan; violations: string[] }): Promise<AgentDecision>;
}

export class PolicyFirstOrchestratorAgent implements OrchestratorAgent {
  async decide(input: { intent: BuilderIntent; plan: BuilderPlan; violations: string[] }): Promise<AgentDecision> {
    if (input.violations.length) {
      return { action: "block", reason: `Policy blocked orchestration: ${input.violations.join("; ")}` };
    }
    return {
      action: "build",
      reason: `Plan ${input.plan.id} passed governance for ${input.intent.name}`,
      confidence: 1,
    };
  }
}

export class HoareAgenticOrchestrator {
  constructor(
    private readonly executor: BuilderExecutor,
    private readonly agent: OrchestratorAgent = new PolicyFirstOrchestratorAgent(),
  ) {}

  async run(context: OrchestrationContext): Promise<OrchestrationResult> {
    const plan = planBuilderIntent(
      context.intent,
      context.provider ?? "hoare",
      context.environment ?? "development",
    );

    const violations = evaluateBuilderPolicy(plan, context.policy);
    const decision = await this.agent.decide({ intent: context.intent, plan, violations });

    if (decision.action === "block") {
      return { phase: "blocked", decision, plan, violations };
    }

    let approved = transitionBuilderPlan(plan, "approve").plan;
    approved = transitionBuilderPlan(approved, "start").plan;
    const execution = await this.executor.execute(approved);
    const ready = transitionBuilderPlan(approved, "complete").plan;

    return {
      phase: "complete",
      decision,
      plan: ready,
      violations,
      execution,
    };
  }
}
