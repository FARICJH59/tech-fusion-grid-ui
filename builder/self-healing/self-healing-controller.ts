import { createHash } from "node:crypto";

export type IncidentSeverity = "low" | "medium" | "high" | "critical";
export type RemediationAction = "restart" | "scale" | "rollback" | "isolate";

export interface Incident {
  incidentId: string;
  service: string;
  symptom: string;
  severity: IncidentSeverity;
  observedAt: string;
}

export interface RemediationUnit {
  unitId: string;
  commandId: `remediate.${RemediationAction}`;
  parameters: Record<string, string | number | boolean>;
  dependencies: string[];
  simulationHash: string;
  provenanceHash: string;
}

export interface SelfHealingPolicy {
  allowedActions: RemediationAction[];
  maxAttempts: number;
  autonomousSeverities: IncidentSeverity[];
}

export interface SelfHealingDecision {
  incidentId: string;
  decision: "REMEDIATE" | "ESCALATE" | "IGNORE";
  reason: string;
  units: RemediationUnit[];
}

const actionMap: Record<IncidentSeverity, RemediationAction> = {
  low: "restart",
  medium: "restart",
  high: "scale",
  critical: "rollback",
};

function hash(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

export function planSelfHealing(incident: Incident, policy: SelfHealingPolicy): SelfHealingDecision {
  if (!policy.autonomousSeverities.includes(incident.severity)) {
    return { incidentId: incident.incidentId, decision: "ESCALATE", reason: "SEVERITY_REQUIRES_REVIEW", units: [] };
  }

  const action = actionMap[incident.severity];
  if (!policy.allowedActions.includes(action)) {
    return { incidentId: incident.incidentId, decision: "ESCALATE", reason: "REMEDIATION_NOT_ALLOWED", units: [] };
  }

  const parameters = { service: incident.service, symptom: incident.symptom };
  const unitId = `remediate-${incident.incidentId}-${action}`;
  const provenanceHash = hash({ incident, unitId, action, parameters });
  const simulationHash = hash({ unitId, action, parameters, policy });

  return {
    incidentId: incident.incidentId,
    decision: "REMEDIATE",
    reason: "GOVERNED_REMEDIATION_ELIGIBLE",
    units: [{
      unitId,
      commandId: `remediate.${action}`,
      parameters,
      dependencies: [],
      simulationHash,
      provenanceHash,
    }],
  };
}

export async function executeSelfHealing(
  decision: SelfHealingDecision,
  hooks: {
    simulate: (unit: RemediationUnit) => Promise<boolean>;
    authorize: (unit: RemediationUnit) => Promise<boolean>;
    execute: (unit: RemediationUnit) => Promise<void>;
    verify: (incident: Incident, unit: RemediationUnit) => Promise<boolean>;
  },
  incident: Incident,
  maxAttempts: number,
): Promise<{ recovered: boolean; attempts: number; reason: string }> {
  if (decision.decision !== "REMEDIATE" || decision.units.length === 0) {
    return { recovered: false, attempts: 0, reason: decision.reason };
  }

  let attempts = 0;
  for (const unit of decision.units) {
    for (let attempt = 1; attempt <= Math.max(1, maxAttempts); attempt += 1) {
      attempts += 1;
      if (!(await hooks.simulate(unit))) return { recovered: false, attempts, reason: "SIMULATION_DENIED" };
      if (!(await hooks.authorize(unit))) return { recovered: false, attempts, reason: "GOVERNANCE_DENIED" };

      await hooks.execute(unit);
      if (await hooks.verify(incident, unit)) {
        return { recovered: true, attempts, reason: "RECOVERY_VERIFIED" };
      }
    }
  }

  return { recovered: false, attempts, reason: "RECOVERY_FAILED_ESCALATE" };
}
