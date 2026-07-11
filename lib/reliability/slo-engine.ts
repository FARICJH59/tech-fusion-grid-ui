export type SloDefinition = {
  id: string;
  tenantId: string;
  service: string;
  availabilityTarget: number;
  latencyTargetMs: number;
  errorRateTarget: number;
};

export type SloSnapshot = {
  definitionId: string;
  availability: number;
  latencyMs: number;
  errorRate: number;
  errorBudgetRemaining: number;
  reliabilityScore: number;
  breached: boolean;
};

export class ReliabilityEngine {
  private readonly definitions = new Map<string, SloDefinition>();

  define(slo: SloDefinition): void {
    this.definitions.set(slo.id, slo);
  }

  evaluate(definitionId: string, telemetry: { availability: number; latencyMs: number; errorRate: number }): SloSnapshot | null {
    const definition = this.definitions.get(definitionId);
    if (!definition) return null;

    const availabilityScore = Math.min(1, telemetry.availability / definition.availabilityTarget);
    const latencyScore = Math.min(1, definition.latencyTargetMs / Math.max(telemetry.latencyMs, 1));
    const errorScore = Math.min(1, definition.errorRateTarget / Math.max(telemetry.errorRate, 0.0001));
    const reliabilityScore = Number(((availabilityScore + latencyScore + errorScore) / 3).toFixed(3));
    const errorBudgetRemaining = Number((Math.max(0, definition.errorRateTarget - telemetry.errorRate)).toFixed(4));

    return {
      definitionId,
      availability: telemetry.availability,
      latencyMs: telemetry.latencyMs,
      errorRate: telemetry.errorRate,
      errorBudgetRemaining,
      reliabilityScore,
      breached:
        telemetry.availability < definition.availabilityTarget ||
        telemetry.latencyMs > definition.latencyTargetMs ||
        telemetry.errorRate > definition.errorRateTarget,
    };
  }
}

export const reliabilityEngine = new ReliabilityEngine();
