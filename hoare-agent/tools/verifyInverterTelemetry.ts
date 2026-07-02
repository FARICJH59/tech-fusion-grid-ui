/**
 * hoare-agent/tools/verifyInverterTelemetry.ts
 *
 * Tool: verifyInverterTelemetry
 * Validates an inverter telemetry payload against configurable threshold rules.
 * Returns a structured result indicating whether readings are within safe bounds.
 */

export interface InverterTelemetry {
  deviceId: string;
  timestamp: string;
  voltageAC: number;       // V
  currentAC: number;       // A
  frequencyHz: number;     // Hz
  powerOutputW: number;    // W
  temperatureC: number;    // °C
  dcVoltage?: number;      // V (optional, for PV inverters)
  dcCurrent?: number;      // A (optional, for PV inverters)
}

export interface ThresholdConfig {
  voltageAC: { min: number; max: number };
  currentAC: { min: number; max: number };
  frequencyHz: { min: number; max: number };
  powerOutputW: { min: number; max: number };
  temperatureC: { min: number; max: number };
}

export interface TelemetryFinding {
  field: string;
  value: number;
  expected: string;
  severity: "warning" | "critical";
  message: string;
}

export interface TelemetryVerificationResult {
  status: "ok" | "warning" | "critical";
  deviceId: string;
  timestamp: string;
  findings: TelemetryFinding[];
}

const DEFAULT_THRESHOLDS: ThresholdConfig = {
  voltageAC: { min: 207, max: 253 },     // ±10 % of 230 V nominal
  currentAC: { min: 0, max: 32 },
  frequencyHz: { min: 49.5, max: 50.5 },
  powerOutputW: { min: 0, max: 10_000 },
  temperatureC: { min: -10, max: 85 },
};

function checkField(
  field: keyof ThresholdConfig,
  value: number,
  thresholds: ThresholdConfig
): TelemetryFinding | null {
  const { min, max } = thresholds[field];
  if (value < min || value > max) {
    const deviation = value < min ? value - min : value - max;
    const severity: TelemetryFinding["severity"] =
      Math.abs(deviation) / (max - min) > 0.1 ? "critical" : "warning";
    return {
      field,
      value,
      expected: `[${min}, ${max}]`,
      severity,
      message: `${field} value ${value} is outside the acceptable range [${min}, ${max}]`,
    };
  }
  return null;
}

/**
 * Verifies a single inverter telemetry snapshot against threshold rules.
 *
 * @param telemetry  - The raw telemetry payload from the inverter.
 * @param thresholds - Optional custom thresholds; falls back to defaults.
 * @returns          A structured verification result.
 */
export function verifyInverterTelemetry(
  telemetry: InverterTelemetry,
  thresholds: ThresholdConfig = DEFAULT_THRESHOLDS
): TelemetryVerificationResult {
  const findings: TelemetryFinding[] = [];

  const fields: Array<keyof ThresholdConfig> = [
    "voltageAC",
    "currentAC",
    "frequencyHz",
    "powerOutputW",
    "temperatureC",
  ];

  for (const field of fields) {
    const value = telemetry[field];
    if (typeof value === "number") {
      const finding = checkField(field, value, thresholds);
      if (finding) findings.push(finding);
    }
  }

  const hasCritical = findings.some((f) => f.severity === "critical");
  const status = hasCritical ? "critical" : findings.length > 0 ? "warning" : "ok";

  return {
    status,
    deviceId: telemetry.deviceId,
    timestamp: telemetry.timestamp,
    findings,
  };
}
