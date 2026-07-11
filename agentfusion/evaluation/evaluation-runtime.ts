import { EvaluationRegistry, calculateQualityScore, type AgentEvaluationMetrics, type AgentEvaluationResult } from "../../packages/agent-sdk/src/evaluation";

export type ExecutionMetricsInput = {
  agentId: string;
  success: boolean;
  latencyMs: number;
  costUsd?: number;
  toolCalls?: number;
  toolFailures?: number;
  tokenUsage?: number;
  tests?: AgentEvaluationResult["tests"];
};

export type AgentPerformanceHistory = {
  agentId: string;
  successRate: number;
  latencyMs: number;
  tokenUsage: number;
  failures: number;
  toolEfficiency: number;
  qualityScore: number;
  executions: number;
};

export class AgentEvaluationRuntime {
  private readonly registry = new EvaluationRegistry();
  private readonly history = new Map<string, ExecutionMetricsInput[]>();

  recordExecution(input: ExecutionMetricsInput): AgentEvaluationResult {
    const existing = this.history.get(input.agentId) ?? [];
    existing.unshift(input);
    this.history.set(input.agentId, existing.slice(0, 100));

    const summary = this.performanceHistory(input.agentId);
    const metrics: AgentEvaluationMetrics = {
      successRate: summary.successRate,
      latencyMs: summary.latencyMs,
      costUsd: input.costUsd ?? 0,
      safetyScore: input.success ? 1 : 0.5,
      reliabilityScore: Math.max(0, 1 - summary.failures / Math.max(summary.executions, 1)),
    };

    return this.registry.record({
      agentId: input.agentId,
      timestamp: new Date().toISOString(),
      tests: input.tests ?? [],
      metrics,
      qualityScore: calculateQualityScore(metrics),
      summary: `successRate=${summary.successRate.toFixed(2)}, toolEfficiency=${summary.toolEfficiency.toFixed(2)}`,
    });
  }

  latest(agentId: string): AgentEvaluationResult | undefined {
    return this.registry.latest(agentId);
  }

  performanceHistory(agentId: string): AgentPerformanceHistory {
    const entries = this.history.get(agentId) ?? [];
    const executions = entries.length;
    const successes = entries.filter((entry) => entry.success).length;
    const failures = entries.filter((entry) => !entry.success).length;
    const latencyMs = executions === 0 ? 0 : entries.reduce((sum, entry) => sum + entry.latencyMs, 0) / executions;
    const tokenUsage = entries.reduce((sum, entry) => sum + (entry.tokenUsage ?? 0), 0);
    const totalToolCalls = entries.reduce((sum, entry) => sum + (entry.toolCalls ?? 0), 0);
    const totalToolFailures = entries.reduce((sum, entry) => sum + (entry.toolFailures ?? 0), 0);
    const toolEfficiency = totalToolCalls === 0 ? 1 : Math.max(0, 1 - totalToolFailures / totalToolCalls);
    const successRate = executions === 0 ? 1 : successes / executions;
    const metrics: AgentEvaluationMetrics = {
      successRate,
      latencyMs,
      costUsd: executions === 0 ? 0 : entries.reduce((sum, entry) => sum + (entry.costUsd ?? 0), 0) / executions,
      safetyScore: successes === executions ? 1 : 0.75,
      reliabilityScore: executions === 0 ? 1 : Math.max(0, 1 - failures / executions),
    };

    return {
      agentId,
      successRate,
      latencyMs,
      tokenUsage,
      failures,
      toolEfficiency,
      qualityScore: calculateQualityScore(metrics),
      executions,
    };
  }

  list(): AgentEvaluationResult[] {
    return this.registry.list();
  }
}
