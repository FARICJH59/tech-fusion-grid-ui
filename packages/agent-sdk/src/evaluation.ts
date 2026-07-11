export type AgentTestType = "capability" | "workflow";
export type EvaluationMetric = "successRate" | "latencyMs" | "costUsd" | "safetyScore" | "reliabilityScore";

export type AgentTestDefinition = {
  id: string;
  name: string;
  type: AgentTestType;
  description?: string;
};

export type AgentTestResult = {
  id: string;
  type: AgentTestType;
  passed: boolean;
  message?: string;
};

export type AgentEvaluationMetrics = {
  successRate: number;
  latencyMs: number;
  costUsd: number;
  safetyScore: number;
  reliabilityScore: number;
};

export type AgentEvaluationProfile = {
  tests: AgentTestDefinition[];
  metrics: EvaluationMetric[];
  qualityScoring: "weighted-balanced" | "custom";
};

export type AgentEvaluationResult = {
  agentId: string;
  timestamp: string;
  tests: AgentTestResult[];
  metrics: AgentEvaluationMetrics;
  qualityScore: number;
  summary: string;
};

export function calculateQualityScore(metrics: AgentEvaluationMetrics): number {
  const successScore = clamp(metrics.successRate) * 35;
  const safetyScore = clamp(metrics.safetyScore) * 30;
  const reliabilityScore = clamp(metrics.reliabilityScore) * 20;
  const latencyScore = normalizeInverse(metrics.latencyMs, 250, 2_500) * 10;
  const costScore = normalizeInverse(metrics.costUsd, 1, 25) * 5;

  return Math.round((successScore + safetyScore + reliabilityScore + latencyScore + costScore) * 100) / 100;
}

export class EvaluationRegistry {
  private readonly results = new Map<string, AgentEvaluationResult[]>();

  record(result: Omit<AgentEvaluationResult, "qualityScore"> & { qualityScore?: number }): AgentEvaluationResult {
    const normalized: AgentEvaluationResult = {
      ...result,
      qualityScore: result.qualityScore ?? calculateQualityScore(result.metrics),
    };
    const existing = this.results.get(result.agentId) ?? [];
    existing.unshift(normalized);
    this.results.set(result.agentId, existing);
    return normalized;
  }

  latest(agentId: string): AgentEvaluationResult | undefined {
    return this.results.get(agentId)?.[0];
  }

  list(agentId?: string): AgentEvaluationResult[] {
    if (agentId) {
      return [...(this.results.get(agentId) ?? [])];
    }
    return [...this.results.values()].flat();
  }
}

function clamp(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function normalizeInverse(value: number, ideal: number, unacceptable: number): number {
  if (value <= ideal) return 1;
  if (value >= unacceptable) return 0;
  return 1 - (value - ideal) / (unacceptable - ideal);
}
