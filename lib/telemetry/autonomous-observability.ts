import { SpanStatusCode } from "@opentelemetry/api";
import { getMeter, getTracer } from "@/lib/telemetry/otel";

const tracer = getTracer("autonomous-control-plane");
const meter = getMeter("autonomous-control-plane");

const actionSuccessRate = meter.createCounter("autonomous_action_success_total");
const rollbackRate = meter.createCounter("autonomous_rollback_total");
const recoveryDuration = meter.createHistogram("autonomous_incident_recovery_time_ms");
const sloCompliance = meter.createHistogram("autonomous_slo_compliance_ratio");
const tenantReliabilityScore = meter.createHistogram("autonomous_tenant_reliability_score");

export async function traceAutonomousWorkflow<T>(
  name:
    | "cloud-deployment"
    | "scaling-decision"
    | "policy-evaluation"
    | "approval"
    | "incident"
    | "recovery-workflow",
  fn: () => Promise<T>,
): Promise<T> {
  return tracer.startActiveSpan(name, async (span) => {
    try {
      const result = await fn();
      actionSuccessRate.add(1, { workflow: name });
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (error) {
      span.setStatus({ code: SpanStatusCode.ERROR, message: error instanceof Error ? error.message : "workflow failed" });
      throw error;
    } finally {
      span.end();
    }
  });
}

export function recordRollback(workflow: string): void {
  rollbackRate.add(1, { workflow });
}

export function recordRecoveryTime(ms: number): void {
  recoveryDuration.record(ms);
}

export function recordSloCompliance(value: number): void {
  sloCompliance.record(value);
}

export function recordTenantReliabilityScore(value: number, tenantId: string): void {
  tenantReliabilityScore.record(value, { tenantId });
}
