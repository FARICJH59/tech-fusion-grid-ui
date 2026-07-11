export type CostTelemetryRecord = {
  tenantId: string;
  promptTokens: number;
  completionTokens: number;
  embeddingsTokens: number;
  imageGenerations: number;
  videoGenerations: number;
  gpuSeconds: number;
  cloudRunVcpuSeconds: number;
  cloudRunMemoryGbSeconds: number;
  estimatedCostUsd: number;
};

export type CostRecommendation = {
  tenantId: string;
  category:
    | "model-routing"
    | "prompt-optimization"
    | "embedding-batching"
    | "cloud-run-concurrency"
    | "region-rightsizing";
  priority: "low" | "medium" | "high";
  message: string;
};

export class CostOptimizationEngine {
  private readonly records = new Map<string, CostTelemetryRecord[]>();

  ingest(record: CostTelemetryRecord): void {
    const current = this.records.get(record.tenantId) ?? [];
    this.records.set(record.tenantId, [...current, record].slice(-500));
  }

  getTelemetry(tenantId: string): CostTelemetryRecord[] {
    return this.records.get(tenantId) ?? [];
  }

  recommend(tenantId: string): CostRecommendation[] {
    const records = this.getTelemetry(tenantId);
    if (records.length === 0) return [];

    const totals = records.reduce(
      (acc, item) => {
        acc.promptTokens += item.promptTokens;
        acc.completionTokens += item.completionTokens;
        acc.embeddingsTokens += item.embeddingsTokens;
        acc.imageGenerations += item.imageGenerations;
        acc.videoGenerations += item.videoGenerations;
        acc.gpuSeconds += item.gpuSeconds;
        acc.cloudRunVcpuSeconds += item.cloudRunVcpuSeconds;
        acc.cloudRunMemoryGbSeconds += item.cloudRunMemoryGbSeconds;
        acc.estimatedCostUsd += item.estimatedCostUsd;
        return acc;
      },
      {
        promptTokens: 0,
        completionTokens: 0,
        embeddingsTokens: 0,
        imageGenerations: 0,
        videoGenerations: 0,
        gpuSeconds: 0,
        cloudRunVcpuSeconds: 0,
        cloudRunMemoryGbSeconds: 0,
        estimatedCostUsd: 0,
      },
    );

    const recommendations: CostRecommendation[] = [];

    if (totals.completionTokens > totals.promptTokens * 1.5) {
      recommendations.push({
        tenantId,
        category: "prompt-optimization",
        priority: "high",
        message: "Completion token usage is high relative to prompts. Enforce response length controls.",
      });
    }

    if (totals.embeddingsTokens > 100_000) {
      recommendations.push({
        tenantId,
        category: "embedding-batching",
        priority: "medium",
        message: "Batch embedding requests to reduce per-request overhead.",
      });
    }

    if (totals.cloudRunVcpuSeconds > 10_000 || totals.cloudRunMemoryGbSeconds > 10_000) {
      recommendations.push({
        tenantId,
        category: "cloud-run-concurrency",
        priority: "high",
        message: "Cloud Run consumption is elevated. Increase concurrency and tune CPU/memory allocation.",
      });
    }

    if (totals.imageGenerations + totals.videoGenerations > 500) {
      recommendations.push({
        tenantId,
        category: "model-routing",
        priority: "medium",
        message: "Route image/video generation to lower-cost model tiers when SLA permits.",
      });
    }

    if (totals.gpuSeconds > 20_000) {
      recommendations.push({
        tenantId,
        category: "region-rightsizing",
        priority: "medium",
        message: "Shift GPU workloads to cost-optimized regions with equivalent latency SLOs.",
      });
    }

    return recommendations;
  }
}

export const costOptimizationEngine = new CostOptimizationEngine();
