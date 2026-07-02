/**
 * hoare-agent/agent.ts
 *
 * Eve — Grid Intelligence & Telemetry Verification Agent
 *
 * Entry point for the Hoare agent scaffold.
 * Eve verifies inverter telemetry and analyzes grid fault events.
 * She is read-only and advisory; she does not modify live inverter settings.
 *
 * Usage (future integration):
 *   import { EveAgent } from "./agent";
 *   const eve = new EveAgent();
 *   const result = await eve.run({ type: "telemetry", payload: ... });
 */

import {
  verifyInverterTelemetry,
  type InverterTelemetry,
  type ThresholdConfig,
  type TelemetryVerificationResult,
} from "./tools/verifyInverterTelemetry";

import {
  analyzeGridFaults,
  type GridFaultEvent,
  type GridFaultAnalysis,
} from "./tools/analyzeGridFaults";

// ---------------------------------------------------------------------------
// Task definitions
// ---------------------------------------------------------------------------

export interface TelemetryTask {
  type: "telemetry";
  payload: InverterTelemetry;
  thresholds?: ThresholdConfig;
}

export interface FaultAnalysisTask {
  type: "fault_analysis";
  payload: GridFaultEvent[];
}

export type AgentTask = TelemetryTask | FaultAnalysisTask;

export type AgentResult =
  | { type: "telemetry"; result: TelemetryVerificationResult }
  | { type: "fault_analysis"; result: GridFaultAnalysis };

// ---------------------------------------------------------------------------
// Agent class
// ---------------------------------------------------------------------------

export class EveAgent {
  readonly name = "Eve";
  readonly role = "Grid Intelligence & Telemetry Verification Agent";

  /**
   * Runs a task through the appropriate tool.
   *
   * @param task - A telemetry verification or fault analysis task.
   * @returns    The structured result produced by the tool.
   */
  run(task: TelemetryTask): { type: "telemetry"; result: TelemetryVerificationResult };
  run(task: FaultAnalysisTask): { type: "fault_analysis"; result: GridFaultAnalysis };
  run(task: AgentTask): AgentResult {
    switch (task.type) {
      case "telemetry": {
        const result = verifyInverterTelemetry(task.payload, task.thresholds);
        return { type: "telemetry", result };
      }
      case "fault_analysis": {
        const result = analyzeGridFaults(task.payload);
        return { type: "fault_analysis", result };
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Default export
// ---------------------------------------------------------------------------

export default EveAgent;
