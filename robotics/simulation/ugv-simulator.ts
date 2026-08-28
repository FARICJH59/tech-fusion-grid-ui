import type { ResupplyMission, UgvState } from "../core/types";

export interface SimulationResult {
  missionId: string;
  status: "completed" | "failed";
  finalState: UgvState;
  telemetry: Array<{
    step: number;
    position: { x: number; y: number };
    batteryPercent: number;
  }>;
}

export function simulateUgvMission(
  mission: ResupplyMission,
): SimulationResult {
  const telemetry = [];

  const steps = 5;

  for (let step = 0; step <= steps; step++) {
    const progress = step / steps;

    telemetry.push({
      step,
      position: {
        x:
          mission.origin.x +
          (mission.destination.x - mission.origin.x) * progress,
        y:
          mission.origin.y +
          (mission.destination.y - mission.origin.y) * progress,
      },
      batteryPercent: Math.max(0, 100 - step * 5),
    });
  }

  const finalTelemetry = telemetry[telemetry.length - 1];

  const finalState: UgvState = {
    id: mission.vehicleId,
    position: finalTelemetry.position,
    batteryPercent: finalTelemetry.batteryPercent,
    payloadKg: mission.payloadKg,
    status: "completed",
  };

  return {
    missionId: mission.missionId,
    status: "completed",
    finalState,
    telemetry,
  };
}
