export type BuildCapability = {
  id: string;
  display_name: string;
  languages: string[];
  markers: string[];
  build_systems: string[];
  toolchains: string[];
  workload_classes: string[];
  targets: string[];
  aegisc_native?: boolean;
};

export type DetectedBuildCapability = BuildCapability & {
  detected_by: string[];
  confidence: "high" | "medium" | "low";
};
