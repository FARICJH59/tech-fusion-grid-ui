import type { InjectedFailure } from "@/lib/testing/failure-injector";

export type RecoveryReport = {
  tenantId: string;
  scenario: string;
  recovered: boolean;
  detectionMs: number;
  rollbackMs: number;
  verificationMs: number;
  recoveryTimeMs: number;
  reliabilityScore: number;
};

export class RecoveryValidator {
  validate(failure: InjectedFailure, timings: { detectionMs: number; rollbackMs: number; verificationMs: number }): RecoveryReport {
    const recoveryTimeMs = timings.detectionMs + timings.rollbackMs + timings.verificationMs;
    const reliabilityScore = Number(Math.max(0, 100 - recoveryTimeMs / 100).toFixed(2));

    return {
      tenantId: failure.tenantId,
      scenario: failure.scenario,
      recovered: recoveryTimeMs < 10_000,
      detectionMs: timings.detectionMs,
      rollbackMs: timings.rollbackMs,
      verificationMs: timings.verificationMs,
      recoveryTimeMs,
      reliabilityScore,
    };
  }
}

export const recoveryValidator = new RecoveryValidator();
