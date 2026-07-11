import type { ScalingDecision, ScalingSignal } from "@/lib/cloud/cloud-types";

export class IntelligentScalingEngine {
  decide(signal: ScalingSignal): ScalingDecision {
    const overloaded =
      signal.requestLatencyMs > signal.tenantSlaLatencyMs ||
      signal.cpuUtilization > 0.8 ||
      signal.memoryUtilization > 0.85 ||
      signal.errorRate > 0.03 ||
      signal.queueDepth > 100;

    const underutilized =
      signal.cpuUtilization < 0.35 &&
      signal.memoryUtilization < 0.4 &&
      signal.requestVolumePerMinute < 80 &&
      signal.errorRate < 0.01;

    if (signal.projectedCostUsd > signal.budgetLimitUsd) {
      return {
        tenantId: signal.tenantId,
        service: signal.service,
        decision: "cost-protect",
        reason: "Projected cost exceeds tenant budget, require governance approval",
        target: {
          minInstances: 1,
          maxInstances: 2,
          concurrency: 120,
        },
        requiresApproval: true,
      };
    }

    if (overloaded && signal.regionalAvailability > 0.5) {
      return {
        tenantId: signal.tenantId,
        service: signal.service,
        decision: "scale-up",
        reason: "Latency or utilization exceeds SLA threshold and capacity is available",
        target: {
          minInstances: 2,
          maxInstances: 8,
          concurrency: 60,
        },
        requiresApproval: false,
      };
    }

    if (underutilized) {
      return {
        tenantId: signal.tenantId,
        service: signal.service,
        decision: "scale-down",
        reason: "Sustained low utilization while maintaining SLA",
        target: {
          minInstances: 1,
          maxInstances: 3,
          concurrency: 100,
        },
        requiresApproval: false,
      };
    }

    return {
      tenantId: signal.tenantId,
      service: signal.service,
      decision: "no-op",
      reason: "Current state is within SLA and budget controls",
      target: {
        minInstances: 1,
        maxInstances: 4,
        concurrency: 80,
      },
      requiresApproval: false,
    };
  }
}

export const scalingEngine = new IntelligentScalingEngine();
