import type { ModelProject, TrainingJob } from "./types";

const projects = new Map<string, ModelProject>();
const trainingJobs = new Map<string, TrainingJob>();

export function createModelProject(input: Omit<ModelProject, "id" | "status">): ModelProject {
  const project: ModelProject = { ...input, id: `model-${Date.now().toString(36)}`, status: "draft" };
  projects.set(project.id, project);
  return project;
}

export function getModelProject(id: string): ModelProject | undefined { return projects.get(id); }
export function listModelProjects(tenantId?: string): ModelProject[] {
  return [...projects.values()].filter((project) => !tenantId || project.tenantId === tenantId);
}
export function saveTrainingJob(job: TrainingJob): TrainingJob { trainingJobs.set(job.id, job); return job; }
export function listTrainingJobs(projectId?: string): TrainingJob[] {
  return [...trainingJobs.values()].filter((job) => !projectId || job.projectId === projectId);
}
