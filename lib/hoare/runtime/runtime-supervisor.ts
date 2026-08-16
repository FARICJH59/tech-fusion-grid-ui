import { NativeRuntimeExecutor, type ServiceSpec, type ServiceRuntime } from "./native-executor";

export type DeploymentPlan = {
  applicationId: string;
  root: string;
  services: ServiceSpec[];
};

export type DeploymentStatus = {
  applicationId: string;
  phase: "idle" | "starting" | "running" | "degraded" | "stopped";
  services: ServiceRuntime[];
  updatedAt: string;
};

export class RuntimeSupervisor {
  private readonly executor: NativeRuntimeExecutor;
  private readonly deployments = new Map<string, DeploymentStatus>();

  constructor(executor = new NativeRuntimeExecutor()) {
    this.executor = executor;
  }

  deploy(plan: DeploymentPlan): DeploymentStatus {
    const now = new Date().toISOString();
    this.deployments.set(plan.applicationId, {
      applicationId: plan.applicationId,
      phase: "starting",
      services: [],
      updatedAt: now,
    });

    const services = plan.services.map((service) => this.executor.start(service));
    const status: DeploymentStatus = {
      applicationId: plan.applicationId,
      phase: services.length > 0 ? "running" : "idle",
      services,
      updatedAt: new Date().toISOString(),
    };
    this.deployments.set(plan.applicationId, status);
    return status;
  }

  stop(applicationId: string): DeploymentStatus | undefined {
    const current = this.deployments.get(applicationId);
    if (!current) return undefined;

    for (const service of current.services) this.executor.stop(service.id);
    const status = {
      ...current,
      phase: "stopped" as const,
      services: current.services.map((service) => ({ ...service, state: "stopped" as const })),
      updatedAt: new Date().toISOString(),
    };
    this.deployments.set(applicationId, status);
    return status;
  }

  restart(plan: DeploymentPlan): DeploymentStatus {
    const current = this.deployments.get(plan.applicationId);
    if (current) {
      for (const service of current.services) this.executor.stop(service.id);
    }
    return this.deploy(plan);
  }

  status(applicationId: string): DeploymentStatus | undefined {
    const current = this.deployments.get(applicationId);
    if (!current) return undefined;
    return {
      ...current,
      services: current.services.map((service) => ({ ...service })),
    };
  }

  all(): DeploymentStatus[] {
    return [...this.deployments.values()].map((deployment) => ({
      ...deployment,
      services: deployment.services.map((service) => ({ ...service })),
    }));
  }
}
