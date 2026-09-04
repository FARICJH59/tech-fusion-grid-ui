import { AgentRuntime, type AgentExecutionResult } from "@/agentfusion/runtime";
import type { Agent } from "@/packages/agent-sdk/src/agent";
import type { AgentExecutionContext } from "@/packages/agent-sdk/src/context";
import type { AgenticDecisionEngine, AgenticExecutor, AgenticVerifier, AgentLoopState, OrchestratorDecision, OrchestratorObservation } from "./agent-loop";
import type { HoareAgentRuntime } from "./runtime-bridge";

export interface HoareAgentResolver {
  resolve(tenantId: string, agentId: string, version?: string): Promise<Agent | null>;
}

export interface AgentContextFactory {
  create(agent: Agent, input: { tenantId: string; observations: OrchestratorObservation[]; cycle: number }): AgentExecutionContext;
}

export class AgentFusionHoareRuntime implements HoareAgentRuntime {
  constructor(
    private readonly runtime: AgentRuntime,
    private readonly resolver: HoareAgentResolver,
    private readonly contextFactory: AgentContextFactory,
    private readonly decisionAgentId: string,
  ) {}

  async decide(input: { observations: OrchestratorObservation[]; cycle: number }): Promise<OrchestratorDecision> {
    const tenantId = input.observations[0]?.tenantId ?? "system";
    const agent = await this.requireAgent(tenantId, this.decisionAgentId);
    const context = this.contextFactory.create(agent, { tenantId, observations: input.observations, cycle: input.cycle });
    const result = await this.runtime.executeAgent({
      agentId: agent.identity.id,
      tenantId,
      context,
      payload: { observations: input.observations, cycle: input.cycle },
    });
    return this.readDecision(result);
  }

  async execute(decision: OrchestratorDecision, contextState: AgentLoopState): Promise<{ success: boolean; detail: string }> {
    const tenantId = contextState.observations[0]?.tenantId ?? "system";
    const agent = await this.requireAgent(tenantId, this.decisionAgentId);
    const context = this.contextFactory.create(agent, { tenantId, observations: contextState.observations, cycle: contextState.cycle });
    const result = await this.runtime.executeAgent({
      agentId: agent.identity.id,
      tenantId,
      context,
      payload: { decision, state: contextState },
    });
    return { success: result.status === "completed", detail: result.error ?? "AgentFusion execution completed" };
  }

  async verify(contextState: AgentLoopState): Promise<{ healthy: boolean; detail: string }> {
    const remediation = contextState.decisions.filter((decision) => decision.action === "remediate");
    return {
      healthy: remediation.length === 0,
      detail: remediation.length === 0 ? "No remediation decisions pending" : `${remediation.length} remediation decision(s) remain`,
    };
  }

  private async requireAgent(tenantId: string, agentId: string): Promise<Agent> {
    const agent = await this.resolver.resolve(tenantId, agentId);
    if (!agent) throw new Error(`Agent '${agentId}' is not available for tenant '${tenantId}'`);
    return agent;
  }

  private readDecision(result: AgentExecutionResult): OrchestratorDecision {
    if (result.status !== "completed") return { action: "block", reason: result.error ?? "Decision agent execution failed", confidence: 0 };
    const output = result.output as Partial<OrchestratorDecision> | undefined;
    if (!output?.action || !["build", "remediate", "wait", "block"].includes(output.action)) {
      return { action: "block", reason: "Decision agent returned an invalid decision", confidence: 0 };
    }
    return {
      action: output.action,
      reason: typeof output.reason === "string" ? output.reason : "Decision returned by AgentFusion",
      confidence: typeof output.confidence === "number" ? Math.max(0, Math.min(1, output.confidence)) : 0,
    };
  }
}

export function createAgentFusionLoopDependencies(runtime: HoareAgentRuntime): {
  decisionEngine: AgenticDecisionEngine;
  executor: AgenticExecutor;
  verifier: AgenticVerifier;
} {
  return {
    decisionEngine: { decide: runtime.decide.bind(runtime) },
    executor: { execute: runtime.execute.bind(runtime) },
    verifier: { verify: runtime.verify.bind(runtime) },
  };
}
