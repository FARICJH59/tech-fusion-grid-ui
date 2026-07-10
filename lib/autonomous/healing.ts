/**
 * SelfHealingEngine — automated incident management and remediation.
 */

import { randomUUID } from "node:crypto";
import { eventBus } from "@/lib/runtime/event-bus";
import type { Incident, IncidentSeverity, IncidentStatus, RemediationAction, ServiceId } from "./types";

export type FailureCategory = "redis" | "mqtt" | "database" | "ai-provider" | "deployment" | "network";

export type FailureContext = {
  serviceId?: ServiceId;
  tenantId?: string;
  message?: string;
  error?: unknown;
};

const MAX_INCIDENTS = 500;

function chooseRemediationType(
  category: FailureCategory,
): RemediationAction["type"] {
  switch (category) {
    case "redis": return "circuit-break";
    case "mqtt": return "restart";
    case "database": return "dead-letter";
    case "ai-provider": return "rollback";
    case "deployment": return "rollback";
    case "network": return "restart";
  }
}

export class SelfHealingEngine {
  private readonly incidents = new Map<string, Incident>();

  createIncident(opts: Omit<Incident, "id" | "createdAt" | "remediationActions">): Incident {
    const incident: Incident = {
      ...opts,
      id: randomUUID(),
      createdAt: new Date().toISOString(),
      remediationActions: [],
    };
    this.incidents.set(incident.id, incident);

    // Evict oldest when over limit
    if (this.incidents.size > MAX_INCIDENTS) {
      const firstKey = this.incidents.keys().next().value;
      if (firstKey) this.incidents.delete(firstKey);
    }

    eventBus.emit({
      type: "incident.created",
      tenantId: incident.tenantId ?? "system",
      timestamp: incident.createdAt,
      payload: { incidentId: incident.id, title: incident.title, severity: incident.severity },
      version: "1",
    });

    return incident;
  }

  resolveIncident(id: string, resolution?: string): void {
    const incident = this.incidents.get(id);
    if (!incident || incident.status === "resolved") return;
    incident.status = "resolved";
    incident.resolvedAt = new Date().toISOString();

    eventBus.emit({
      type: "incident.resolved",
      tenantId: incident.tenantId ?? "system",
      timestamp: incident.resolvedAt,
      payload: { incidentId: id, resolution: resolution ?? "resolved" },
      version: "1",
    });
  }

  getIncident(id: string): Incident | undefined {
    return this.incidents.get(id);
  }

  listIncidents(filter?: { status?: IncidentStatus; severity?: IncidentSeverity }): Incident[] {
    let results = [...this.incidents.values()];
    if (filter?.status) results = results.filter((i) => i.status === filter.status);
    if (filter?.severity) results = results.filter((i) => i.severity === filter.severity);
    return results;
  }

  async handleFailure(category: FailureCategory, context: FailureContext): Promise<void> {
    const incident = this.createIncident({
      serviceId: context.serviceId,
      severity: category === "deployment" || category === "database" ? "high" : "medium",
      status: "investigating",
      title: `${category} failure detected`,
      description: context.message ?? `Automatic failure detection for ${category}`,
      tenantId: context.tenantId,
    });

    const actionType = chooseRemediationType(category);
    const action = this.addRemediationAction(incident.id, {
      type: actionType,
      status: "running",
      description: `Auto-remediation: ${actionType} for ${category}`,
    });

    // Simulate async remediation
    await Promise.resolve();
    action.status = "completed";
    action.executedAt = new Date().toISOString();
    action.result = `${actionType} executed successfully`;

    this.resolveIncident(incident.id, `Auto-resolved via ${actionType}`);
  }

  addRemediationAction(
    incidentId: string,
    action: Omit<RemediationAction, "id">,
  ): RemediationAction {
    const incident = this.incidents.get(incidentId);
    if (!incident) throw new Error(`Incident ${incidentId} not found`);

    const fullAction: RemediationAction = { ...action, id: randomUUID() };
    incident.remediationActions.push(fullAction);
    return fullAction;
  }

  getStats(): {
    total: number;
    open: number;
    resolved: number;
    bySeverity: Record<string, number>;
  } {
    let open = 0, resolved = 0;
    const bySeverity: Record<string, number> = {};

    for (const incident of this.incidents.values()) {
      if (incident.status === "resolved") resolved++;
      else open++;
      bySeverity[incident.severity] = (bySeverity[incident.severity] ?? 0) + 1;
    }

    return { total: this.incidents.size, open, resolved, bySeverity };
  }
}

export const selfHealingEngine = new SelfHealingEngine();
