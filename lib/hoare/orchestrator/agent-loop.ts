export type OrchestratorPhase = "observe" | "plan" | "govern" | "act" | "verify" | "remediate" | "complete" | "blocked";

export type OrchestratorObservation = {
  id: string;
  tenantId: string;
  source: string;
  type: string;
  data: Record<string, unknown>;
  observedAt: string;
};

export type OrchestratorDecision = {
  action: "build" | "remediate" | "wait" | "block";
  reason: string;
  confidence: number;
};

export type AgentLoopState = {
  phase: OrchestratorPhase;
  observations: OrchestratorObservation[];
  decisions: OrchestratorDecision[];
  cycle: number;
};

export interface AgenticDecisionEngine {
  decide(input: { observations: OrchestratorObservation[]; cycle: number }): Promise<OrchestratorDecision>;
}

export interface AgenticExecutor {
  execute(decision: OrchestratorDecision, context: AgentLoopState): Promise<{ success: boolean; detail: string }>;
}

export interface AgenticVerifier {
  verify(context: AgentLoopState): Promise<{ healthy: boolean; detail: string }>;
}

export class AgenticOrchestratorLoop {
  constructor(
    private readonly decisionEngine: AgenticDecisionEngine,
    private readonly executor: AgenticExecutor,
    private readonly verifier: AgenticVerifier,
  ) {}

  async runCycle(state: AgentLoopState): Promise<AgentLoopState> {
    const observed: AgentLoopState = { ...state, phase: "observe", cycle: state.cycle + 1 };
    const decision = await this.decisionEngine.decide({ observations: observed.observations, cycle: observed.cycle });
    const governed: AgentLoopState = {
      ...observed,
      phase: decision.action === "block" ? "blocked" : "govern",
      decisions: [...observed.decisions, decision],
    };
    if (decision.action === "block" || decision.action === "wait") return governed;

    const acted: AgentLoopState = { ...governed, phase: "act" };
    const result = await this.executor.execute(decision, acted);
    if (!result.success) return { ...acted, phase: "remediate" };

    const verification = await this.verifier.verify(acted);
    return {
      ...acted,
      phase: verification.healthy ? "complete" : "remediate",
    };
  }
}
