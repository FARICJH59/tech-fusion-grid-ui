import type { DeploymentPlan, DeploymentStatus } from "./runtime-supervisor";

export class DeploymentRegistry {
  private readonly plans = new Map<string, DeploymentPlan>();
  private readonly statuses = new Map<string, DeploymentStatus>();

  savePlan(plan: DeploymentPlan): void {
    this.plans.set(plan.applicationId, plan);
  }

  getPlan(applicationId: string): DeploymentPlan | undefined {
    return this.plans.get(applicationId);
  }

  saveStatus(status: DeploymentStatus): void {
    this.statuses.set(status.applicationId, status);
  }

  getStatus(applicationId: string): DeploymentStatus | undefined {
    return this.statuses.get(applicationId);
  }

  all(): DeploymentStatus[] {
    return [...this.statuses.values()];
  }
}
