export type RootCauseReport = {
  incidentId: string;
  probableCause: string;
  confidence: number;
  evidence: string[];
};

export class RootCauseAgent {
  diagnose(incidentId: string, signals: { errorRate: number; latencyMs: number; failedChecks: string[] }): RootCauseReport {
    if (signals.failedChecks.length > 0) {
      return {
        incidentId,
        probableCause: "health-check-failure",
        confidence: 0.89,
        evidence: signals.failedChecks,
      };
    }

    if (signals.errorRate > 0.05) {
      return {
        incidentId,
        probableCause: "runtime-error-regression",
        confidence: 0.82,
        evidence: [`error-rate=${signals.errorRate}`],
      };
    }

    return {
      incidentId,
      probableCause: "latency-regression",
      confidence: signals.latencyMs > 1200 ? 0.78 : 0.6,
      evidence: [`latency-ms=${signals.latencyMs}`],
    };
  }
}

export const rootCauseAgent = new RootCauseAgent();
