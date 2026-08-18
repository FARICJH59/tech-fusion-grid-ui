export type SentinelMode = "ADVISORY" | "AUTONOMOUS_DEFENSE";
export type SentinelDecision = "ALLOW" | "ISOLATE" | "CAPTURE_EVIDENCE" | "ESCALATE";

export type SentinelEvent = {
  tenantId: string;
  deviceId: string;
  eventType: string;
  severity: "info" | "warning" | "critical";
  attributes?: Record<string, string | number | boolean>;
  timestamp?: string;
};

export type SentinelPolicy = {
  id: string;
  mode: SentinelMode;
  criticalEventTypes: string[];
  allowedActions: Array<"network.isolate" | "evidence.capture">;
};

export type SentinelResult = {
  decision: SentinelDecision;
  actions: string[];
  reason: string;
  event: SentinelEvent;
};

export class SentinelRuntime {
  constructor(private readonly policy: SentinelPolicy) {}

  evaluate(event: SentinelEvent): SentinelResult {
    if (event.severity !== "critical" || !this.policy.criticalEventTypes.includes(event.eventType)) {
      return { decision: "ALLOW", actions: [], reason: "Event does not match the autonomous-defense trigger policy.", event };
    }

    const actions = this.policy.allowedActions.filter((action) => action === "network.isolate" || action === "evidence.capture");
    if (this.policy.mode === "ADVISORY") {
      return { decision: "ESCALATE", actions, reason: "Critical event detected; advisory mode requires operator action.", event };
    }

    if (actions.includes("network.isolate")) return { decision: "ISOLATE", actions, reason: "Critical event matched an autonomous isolation policy.", event };
    if (actions.includes("evidence.capture")) return { decision: "CAPTURE_EVIDENCE", actions, reason: "Critical event matched an evidence-capture policy.", event };
    return { decision: "ESCALATE", actions: [], reason: "Critical event detected but no permitted defensive action is configured.", event };
  }
}
