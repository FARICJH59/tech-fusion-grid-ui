export type TrainingJobStatus = "queued" | "running" | "succeeded" | "failed" | "cancelled";

export interface ModelProject {
  id: string;
  tenantId: string;
  name: string;
  baseModel?: string;
  datasetIds: string[];
  runtimeNodeId?: string;
  status: "draft" | "ready" | "training" | "validated" | "deployed";
}

export interface TrainingJob {
  id: string;
  projectId: string;
  nodeId: string;
  image: string;
  command: string[];
  status: TrainingJobStatus;
  metrics: Record<string, number>;
}

export interface ModelArtifact {
  id: string;
  projectId: string;
  version: string;
  uri: string;
  checksum?: string;
  validationStatus: "pending" | "passed" | "failed";
}
