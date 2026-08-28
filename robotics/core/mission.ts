import type { ResupplyMission } from "./types";

export function createResupplyMission(input: ResupplyMission): ResupplyMission {
  return {
    ...input,
    missionId: input.missionId,
  };
}
