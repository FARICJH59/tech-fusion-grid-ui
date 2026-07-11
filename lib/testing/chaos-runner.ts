import { failureInjector, type FailureScenario } from "@/lib/testing/failure-injector";
import { recoveryValidator, type RecoveryReport } from "@/lib/testing/recovery-validator";

export type ChaosRunResult = {
  reports: RecoveryReport[];
  averageRecoveryMs: number;
  reliabilityScore: number;
};

export class ChaosRunner {
  run(tenantId: string, scenarios: FailureScenario[]): ChaosRunResult {
    const reports = scenarios.map((scenario) => {
      const failure = failureInjector.inject(scenario, tenantId, { source: "chaos-runner" });
      return recoveryValidator.validate(failure, {
        detectionMs: scenario === "regional-service-failure" ? 1000 : 300,
        rollbackMs: scenario === "database-recovery" ? 2600 : 1200,
        verificationMs: 700,
      });
    });

    const averageRecoveryMs = Math.round(
      reports.reduce((sum, report) => sum + report.recoveryTimeMs, 0) / Math.max(reports.length, 1),
    );
    const reliabilityScore = Number(
      (reports.reduce((sum, report) => sum + report.reliabilityScore, 0) / Math.max(reports.length, 1)).toFixed(2),
    );

    return {
      reports,
      averageRecoveryMs,
      reliabilityScore,
    };
  }
}

export const chaosRunner = new ChaosRunner();
