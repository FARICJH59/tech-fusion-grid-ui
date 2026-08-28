import { validateMissionPolicy } from "../core/policy";
import { simulateUgvMission } from "../simulation/ugv-simulator";
import type { ResupplyMission } from "../core/types";

export function runAutonomousResupplySimulation(
  mission: ResupplyMission,
) {
  const policy = validateMissionPolicy(mission);

  if (!policy.allowed) {
    return {
      status: "rejected" as const,
      reasons: policy.reasons,
    };
  }

  const simulation = simulateUgvMission(mission);

  return {
    status: simulation.status,
    mission,
    policy,
    simulation,
  };
}
