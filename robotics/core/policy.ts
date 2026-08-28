import type { ResupplyMission } from "./types";

export interface MissionPolicyResult {
  allowed: boolean;
  reasons: string[];
}

export function validateMissionPolicy(
  mission: ResupplyMission,
): MissionPolicyResult {
  const reasons: string[] = [];

  if (mission.payloadKg <= 0) {
    reasons.push("payload-must-be-positive");
  }

  if (!mission.vehicleId) {
    reasons.push("vehicle-id-required");
  }

  if (!mission.requestedBy) {
    reasons.push("requester-required");
  }

  return {
    allowed: reasons.length === 0,
    reasons,
  };
}
