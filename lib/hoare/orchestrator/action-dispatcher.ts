import type { AgentLoopState, OrchestratorDecision } from "./agent-loop";

export interface HoareActionDispatcher {
  build(input: { context: AgentLoopState; decision: OrchestratorDecision }): Promise<{ success: boolean; detail: string }>;
  remediate(input: { context: AgentLoopState; decision: OrchestratorDecision }): Promise<{ success: boolean; detail: string }>;
}

export class GovernanceAwareActionExecutor {
  constructor(private readonly dispatcher: HoareActionDispatcher) {}

  async execute(decision: OrchestratorDecision, context: AgentLoopState) {
    switch (decision.action) {
      case "build":
        return this.dispatcher.build({ context, decision });
      case "remediate":
        return this.dispatcher.remediate({ context, decision });
      case "wait":
        return { success: true, detail: "No action requested" };
      case "block":
        return { success: false, detail: "Action blocked by orchestrator policy" };
    }
  }
}
