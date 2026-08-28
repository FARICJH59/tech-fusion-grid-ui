export const UGV_CAPABILITIES = [
  "simulated-navigation",
  "telemetry",
  "payload-transport",
  "mission-execution",
] as const;

export type UgvCapability = (typeof UGV_CAPABILITIES)[number];
