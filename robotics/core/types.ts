export type UgvMissionStatus =
  | "planned"
  | "admitted"
  | "executing"
  | "completed"
  | "failed"
  | "aborted";

export interface UgvPosition {
  x: number;
  y: number;
}

export interface UgvState {
  id: string;
  position: UgvPosition;
  batteryPercent: number;
  payloadKg: number;
  status: UgvMissionStatus;
}

export interface ResupplyMission {
  missionId: string;
  vehicleId: string;
  origin: UgvPosition;
  destination: UgvPosition;
  payloadKg: number;
  requestedBy: string;
}
