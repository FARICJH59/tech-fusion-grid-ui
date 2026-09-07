import type { AgenticDecisionEngine, AgenticExecutor, AgenticVerifier, OrchestratorObservation, OrchestratorDecision, AgentLoopState } from "./agent-loop";

export interface HoareAgentRuntime {
  decide(input: { observations: OrchestratorObservation[]; cycle: number }): Promise<OrchestratorDecision>;
  execute(input: { decision: OrchestratorDecision; context: AgentLoopState }): Promise<{ success: boolean; detail: string }>;
  verify(input: { context: AgentLoopState }): Promise<{ healthy: boolean; detail: string }>;
}

export class RuntimeBackedDecisionEngine implements AgenticDecisionEngine {
  constructor(private readonly runtime: HoareAgentRuntime) {}
  decide(input: { observations: OrchestratorObservation[]; cycle: number }) { return this.runtime.decide(input); }
}

export class RuntimeBackedExecutor implements AgenticExecutor {
  constructor(private readonly runtime: HoareAgentRuntime) {}
  execute(decision: OrchestratorDecision, context: AgentLoopState) { return this.runtime.execute({ decision, context }); }
}

export class RuntimeBackedVerifier implements AgenticVerifier {
  constructor(private readonly runtime: HoareAgentRuntime) {}
  verify(context: AgentLoopState) { return this.runtime.verify({ context }); }
}

export function createRuntimeBackedLoopDependencies(runtime: HoareAgentRuntime) {
  return {
    decisionEngine: new RuntimeBackedDecisionEngine(runtime),
    executor: new RuntimeBackedExecutor(runtime),
    verifier: new RuntimeBackedVerifier(runtime),
  };
}
