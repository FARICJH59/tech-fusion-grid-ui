export type TargetKind =
  | "vercel"
  | "cloud-run"
  | "aws"
  | "azure"
  | "kubernetes"
  | "openshift"
  | "tke"
  | "edge"
  | "pi5"
  | "jetson"
  | "bare-metal"
  | "hoare-native";

export interface BuildTarget {
  target_id: string;
  kind: TargetKind;
  region?: string;
  environment: "development" | "staging" | "production";
  capabilities: string[];
}
