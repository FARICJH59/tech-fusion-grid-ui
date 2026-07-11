import { rootCauseAgent } from "@/lib/incidents/root-cause-agent";
import { IncidentTimeline } from "@/lib/incidents/timeline";
import { createPostmortem, type PostmortemReport } from "@/lib/incidents/postmortem";
import { autonomousEventBus } from "@/lib/events/event-bus";

export type IncidentSeverity = "sev0" | "sev1" | "sev2" | "sev3";

export type IncidentRecord = {
  id: string;
  tenantId: string;
  service: string;
  severity: IncidentSeverity;
  status: "open" | "resolved";
  tenantImpact: string;
  actionsExecuted: string[];
  createdAt: string;
  updatedAt: string;
};

export class IncidentManager {
  private readonly incidents = new Map<string, IncidentRecord>();
  readonly timeline = new IncidentTimeline();

  create(input: {
    tenantId: string;
    service: string;
    severity: IncidentSeverity;
    tenantImpact: string;
    reason: string;
  }): IncidentRecord {
    const now = new Date().toISOString();
    const id = `${input.tenantId}:${input.service}:${Date.now().toString(36)}`;
    const incident: IncidentRecord = {
      id,
      tenantId: input.tenantId,
      service: input.service,
      severity: input.severity,
      status: "open",
      tenantImpact: input.tenantImpact,
      actionsExecuted: [],
      createdAt: now,
      updatedAt: now,
    };

    this.incidents.set(id, incident);
    this.timeline.push({ incidentId: id, stage: "detected", message: input.reason, timestamp: now });
    this.timeline.push({ incidentId: id, stage: "created", message: "Incident created", timestamp: now });
    void autonomousEventBus.publish({
      id: `incident:${id}:created`,
      tenantId: input.tenantId,
      organizationId: input.tenantId,
      type: "incident",
      source: "incident-manager",
      priority: input.severity === "sev0" ? "critical" : "high",
      timestamp: now,
      payload: {
        incidentId: id,
        service: input.service,
        severity: input.severity,
        status: "open",
      },
    });
    return incident;
  }

  diagnose(incidentId: string, signals: { errorRate: number; latencyMs: number; failedChecks: string[] }): string {
    const report = rootCauseAgent.diagnose(incidentId, signals);
    this.timeline.push({
      incidentId,
      stage: "diagnosed",
      message: `${report.probableCause} (${report.confidence})`,
      timestamp: new Date().toISOString(),
    });
    return report.probableCause;
  }

  remediate(incidentId: string, action: string): void {
    const incident = this.incidents.get(incidentId);
    if (!incident) return;
    incident.actionsExecuted.push(action);
    incident.updatedAt = new Date().toISOString();
    this.timeline.push({ incidentId, stage: "remediated", message: action, timestamp: incident.updatedAt });
    this.incidents.set(incidentId, incident);
    void autonomousEventBus.publish({
      id: `incident:${incidentId}:remediation:${Date.now().toString(36)}`,
      tenantId: incident.tenantId,
      organizationId: incident.tenantId,
      type: "recovery",
      source: "incident-manager",
      priority: "high",
      timestamp: incident.updatedAt,
      payload: {
        incidentId,
        action,
      },
    });
  }

  verify(incidentId: string, passed: boolean): void {
    this.timeline.push({
      incidentId,
      stage: "verified",
      message: passed ? "Verification passed" : "Verification failed",
      timestamp: new Date().toISOString(),
    });
  }

  resolve(incidentId: string): IncidentRecord | null {
    const incident = this.incidents.get(incidentId);
    if (!incident) return null;
    incident.status = "resolved";
    incident.updatedAt = new Date().toISOString();
    this.timeline.push({ incidentId, stage: "resolved", message: "Incident resolved", timestamp: incident.updatedAt });
    this.incidents.set(incidentId, incident);
    void autonomousEventBus.publish({
      id: `incident:${incidentId}:resolved`,
      tenantId: incident.tenantId,
      organizationId: incident.tenantId,
      type: "recovery",
      source: "incident-manager",
      priority: "medium",
      timestamp: incident.updatedAt,
      payload: {
        incidentId,
        status: incident.status,
      },
    });
    return incident;
  }

  createPostmortem(incidentId: string): PostmortemReport | null {
    const incident = this.incidents.get(incidentId);
    if (!incident) return null;
    const rootCause = rootCauseAgent.diagnose(incidentId, { errorRate: 0, latencyMs: 0, failedChecks: [] });
    return createPostmortem({
      incidentId,
      rootCause,
      tenantImpact: incident.tenantImpact,
      actionsExecuted: incident.actionsExecuted,
      timeToDetectMinutes: 2,
      timeToRecoverMinutes: 8,
    });
  }

  list(): IncidentRecord[] {
    return [...this.incidents.values()];
  }
}

export const incidentManager = new IncidentManager();
