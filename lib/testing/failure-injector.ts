export type FailureScenario =
  | "failed-deployment"
  | "unhealthy-revision"
  | "redis-outage"
  | "mqtt-broker-failure"
  | "regional-service-failure"
  | "secret-rotation-failure"
  | "database-recovery";

export type InjectedFailure = {
  scenario: FailureScenario;
  tenantId: string;
  detectedAt: string;
  metadata: Record<string, unknown>;
};

export class FailureInjector {
  inject(scenario: FailureScenario, tenantId: string, metadata: Record<string, unknown> = {}): InjectedFailure {
    return {
      scenario,
      tenantId,
      detectedAt: new Date().toISOString(),
      metadata,
    };
  }
}

export const failureInjector = new FailureInjector();
