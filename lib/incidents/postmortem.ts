import type { RootCauseReport } from "@/lib/incidents/root-cause-agent";

export type PostmortemReport = {
  incidentId: string;
  rootCause: string;
  tenantImpact: string;
  actionsExecuted: string[];
  recoveryMetrics: {
    timeToDetectMinutes: number;
    timeToRecoverMinutes: number;
  };
  generatedAt: string;
};

export function createPostmortem(input: {
  incidentId: string;
  rootCause: RootCauseReport;
  tenantImpact: string;
  actionsExecuted: string[];
  timeToDetectMinutes: number;
  timeToRecoverMinutes: number;
}): PostmortemReport {
  return {
    incidentId: input.incidentId,
    rootCause: input.rootCause.probableCause,
    tenantImpact: input.tenantImpact,
    actionsExecuted: input.actionsExecuted,
    recoveryMetrics: {
      timeToDetectMinutes: input.timeToDetectMinutes,
      timeToRecoverMinutes: input.timeToRecoverMinutes,
    },
    generatedAt: new Date().toISOString(),
  };
}
