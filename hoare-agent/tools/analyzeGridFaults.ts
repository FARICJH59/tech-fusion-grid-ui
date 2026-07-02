/**
 * hoare-agent/tools/analyzeGridFaults.ts
 *
 * Tool: analyzeGridFaults
 * Classifies and summarizes fault events from grid event logs.
 * Returns a structured analysis with fault categories, severity distribution,
 * and recommended actions.
 */

export type FaultSeverity = "info" | "warning" | "critical";

export type FaultCategory =
  | "over_voltage"
  | "under_voltage"
  | "over_frequency"
  | "under_frequency"
  | "over_temperature"
  | "islanding_event"
  | "dc_arc"
  | "ground_fault"
  | "communication_loss"
  | "hardware_failure"
  | "unknown";

export interface GridFaultEvent {
  eventId: string;
  deviceId: string;
  timestamp: string;
  faultCode: string;
  rawMessage: string;
}

export interface ClassifiedFault {
  eventId: string;
  deviceId: string;
  timestamp: string;
  faultCode: string;
  category: FaultCategory;
  severity: FaultSeverity;
  summary: string;
  recommendedAction: string;
}

export interface GridFaultAnalysis {
  totalEvents: number;
  criticalCount: number;
  warningCount: number;
  infoCount: number;
  affectedDevices: string[];
  categorySummary: Record<FaultCategory, number>;
  classifiedFaults: ClassifiedFault[];
}

// Mapping from fault code prefix / keyword patterns to classification metadata.
const FAULT_RULES: Array<{
  pattern: RegExp;
  category: FaultCategory;
  severity: FaultSeverity;
  summary: string;
  recommendedAction: string;
}> = [
  {
    pattern: /over.?volt|OVP|E001/i,
    category: "over_voltage",
    severity: "critical",
    summary: "AC output voltage exceeded upper limit.",
    recommendedAction: "Isolate inverter from grid immediately and inspect voltage regulation circuitry.",
  },
  {
    pattern: /under.?volt|UVP|E002/i,
    category: "under_voltage",
    severity: "warning",
    summary: "AC output voltage dropped below lower limit.",
    recommendedAction: "Check grid supply quality and inverter input voltage.",
  },
  {
    pattern: /over.?freq|OFP|E003/i,
    category: "over_frequency",
    severity: "warning",
    summary: "Grid frequency exceeded upper threshold.",
    recommendedAction: "Monitor frequency trend; coordinate with grid operator if persistent.",
  },
  {
    pattern: /under.?freq|UFP|E004/i,
    category: "under_frequency",
    severity: "warning",
    summary: "Grid frequency dropped below lower threshold.",
    recommendedAction: "Monitor frequency trend; coordinate with grid operator if persistent.",
  },
  {
    pattern: /over.?temp|OTP|E005/i,
    category: "over_temperature",
    severity: "critical",
    summary: "Inverter internal temperature exceeded safe operating limit.",
    recommendedAction: "Shut down inverter, inspect cooling fans and heat sinks.",
  },
  {
    pattern: /island|E006/i,
    category: "islanding_event",
    severity: "critical",
    summary: "Islanding condition detected — inverter operating without grid connection.",
    recommendedAction: "Disconnect inverter from local load immediately; investigate anti-islanding relay.",
  },
  {
    pattern: /arc|DC.?arc|E007/i,
    category: "dc_arc",
    severity: "critical",
    summary: "DC arc detected on PV string.",
    recommendedAction: "Shut down PV array; inspect wiring and connectors for damage.",
  },
  {
    pattern: /ground.?fault|GFP|E008/i,
    category: "ground_fault",
    severity: "critical",
    summary: "Ground fault detected on DC or AC side.",
    recommendedAction: "Isolate system, perform insulation resistance test before restart.",
  },
  {
    pattern: /comm.?(loss|err|fail)|E009/i,
    category: "communication_loss",
    severity: "warning",
    summary: "Communication link to inverter lost or degraded.",
    recommendedAction: "Check network connectivity, MQTT broker status, and inverter data port.",
  },
  {
    pattern: /hardware|HW.?fail|E010/i,
    category: "hardware_failure",
    severity: "critical",
    summary: "Hardware component failure reported by inverter self-diagnostics.",
    recommendedAction: "Schedule maintenance; do not restart until hardware is inspected.",
  },
];

function classifyFault(event: GridFaultEvent): ClassifiedFault {
  const searchText = `${event.faultCode} ${event.rawMessage}`;

  for (const rule of FAULT_RULES) {
    if (rule.pattern.test(searchText)) {
      return {
        eventId: event.eventId,
        deviceId: event.deviceId,
        timestamp: event.timestamp,
        faultCode: event.faultCode,
        category: rule.category,
        severity: rule.severity,
        summary: rule.summary,
        recommendedAction: rule.recommendedAction,
      };
    }
  }

  return {
    eventId: event.eventId,
    deviceId: event.deviceId,
    timestamp: event.timestamp,
    faultCode: event.faultCode,
    category: "unknown",
    severity: "info",
    summary: "Unrecognised fault code. Manual review required.",
    recommendedAction: "Check inverter manual for fault code " + event.faultCode,
  };
}

/**
 * Analyzes a batch of grid fault events.
 *
 * @param events - Array of raw fault events from the grid gateway or event log.
 * @returns      A structured analysis summary with per-fault classifications.
 */
export function analyzeGridFaults(events: GridFaultEvent[]): GridFaultAnalysis {
  const classifiedFaults = events.map(classifyFault);

  const affectedDevices = [...new Set(classifiedFaults.map((f) => f.deviceId))];

  const categorySummary = {} as Record<FaultCategory, number>;
  let criticalCount = 0;
  let warningCount = 0;
  let infoCount = 0;

  for (const fault of classifiedFaults) {
    categorySummary[fault.category] = (categorySummary[fault.category] ?? 0) + 1;
    if (fault.severity === "critical") criticalCount++;
    else if (fault.severity === "warning") warningCount++;
    else infoCount++;
  }

  return {
    totalEvents: events.length,
    criticalCount,
    warningCount,
    infoCount,
    affectedDevices,
    categorySummary,
    classifiedFaults,
  };
}
