import type { ResupplyMission } from "../core/types";
import { simulateUgvMission } from "../simulation/ugv-simulator";

export interface UgvAdapter {
  simulateMission(mission: ResupplyMission): ReturnType<typeof simulateUgvMission>;
}

export class SimulatedUgvAdapter implements UgvAdapter {
  simulateMission(mission: ResupplyMission) {
    return simulateUgvMission(mission);
  }
}
