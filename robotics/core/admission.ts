import type { ResupplyMission } from "./types";
import { validateMissionPolicy } from "./policy";

export type RoboticsAdmissionStatus =
  | "admitted"
  | "rejected";

export interface RoboticsAdmission {
  schema: "hoare.robotics-admission/v1";
  missionId: string;
  vehicleId: string;
  status: RoboticsAdmissionStatus;
  reasons: string[];
  simulationOnly: true;
  mutationExecuted: false;
}

export function admitRoboticsMission(
  mission: ResupplyMission,
): RoboticsAdmission {
  const policy = validateMissionPolicy(mission);

  return {
    schema: "hoare.robotics-admission/v1",
    missionId: mission.missionId,
    vehicleId: mission.vehicleId,
    status: policy.allowed ? "admitted" : "rejected",
    reasons: policy.reasons,
    simulationOnly: true,
    mutationExecuted: false,
  };
}
