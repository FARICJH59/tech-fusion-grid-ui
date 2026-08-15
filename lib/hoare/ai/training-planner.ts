import type { InfrastructureNode } from "@/lib/hoare/control-plane/types";
import type { ModelProject, TrainingJob } from "./types";

export function planTrainingJob(input: {
  project: ModelProject;
  node: InfrastructureNode;
  image: string;
  command: string[];
}): TrainingJob {
  if (input.project.status !== "ready" && input.project.status !== "training") {
    throw new Error(`Model project ${input.project.id} is not ready for training`);
  }

  if (input.node.status !== "online") {
    throw new Error(`Training node ${input.node.id} is not online`);
  }

  return {
    id: `training-${input.project.id}-${Date.now().toString(36)}`,
    projectId: input.project.id,
    nodeId: input.node.id,
    image: input.image,
    command: input.command,
    status: "queued",
    metrics: {},
  };
}
