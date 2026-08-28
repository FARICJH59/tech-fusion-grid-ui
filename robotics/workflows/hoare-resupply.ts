import { validateMissionPolicy } from "../core/policy";
import { simulateUgvMission } from "../simulation/ugv-simulator";
import { createRobotExecutionReceipt } from "../evidence/robot-execution-receipt";
import type { ResupplyMission } from "../core/types";

export interface HoareResupplyResult {
  admitted: boolean;
  mission: ResupplyMission;
  reasons: string[];
  simulation: ReturnType<typeof simulateUgvMission> | null;
  receipt: ReturnType<typeof createRobotExecutionReceipt>;
}

export function executeGovernedResupplySimulation(
  mission: ResupplyMission,
): HoareResupplyResult {
  const policy = validateMissionPolicy(mission);

  if (!policy.allowed) {
    return {
      admitted: false,
      mission,
      reasons: policy.reasons,
      simulation: null,
      receipt: createRobotExecutionReceipt({
        missionId: mission.missionId,
        vehicleId: mission.vehicleId,
        status: "rejected",
      }),
    };
  }

  const simulation = simulateUgvMission(mission);

  return {
    admitted: true,
    mission,
    reasons: [],
    simulation,
    receipt: createRobotExecutionReceipt({
      missionId: mission.missionId,
      vehicleId: mission.vehicleId,
      status: simulation.status,
    }),
  };
}
