import type { ServiceHealth } from "@/lib/enterprise/types";

export const INFRA_COMPONENTS = [
  "Docker",
  "Kubernetes",
  "Cloud Run",
  "Redis",
  "PostgreSQL",
  "EMQX MQTT",
  "NVIDIA GPU runtime",
  "Object Storage",
] as const;

export type InfrastructureComponent = (typeof INFRA_COMPONENTS)[number];

export type InfrastructureAdapter = {
  component: InfrastructureComponent;
  vendor: string;
  region: string;
  health: ServiceHealth;
  metadata: Record<string, string>;
};

export class InfrastructureRegistry {
  private readonly adapters = new Map<InfrastructureComponent, InfrastructureAdapter>();

  register(adapter: InfrastructureAdapter): void {
    this.adapters.set(adapter.component, adapter);
  }

  replace(component: InfrastructureComponent, adapter: InfrastructureAdapter): void {
    this.adapters.set(component, adapter);
  }

  get(component: InfrastructureComponent): InfrastructureAdapter | null {
    return this.adapters.get(component) ?? null;
  }

  list(): InfrastructureAdapter[] {
    return [...this.adapters.values()];
  }
}

export function createDefaultInfrastructure(region = "global"): InfrastructureRegistry {
  const registry = new InfrastructureRegistry();

  const defaults: Record<InfrastructureComponent, string> = {
    Docker: "docker",
    Kubernetes: "gke",
    "Cloud Run": "google-cloud-run",
    Redis: "redis",
    PostgreSQL: "postgresql",
    "EMQX MQTT": "emqx",
    "NVIDIA GPU runtime": "nvidia",
    "Object Storage": "gcs",
  };

  for (const component of INFRA_COMPONENTS) {
    registry.register({
      component,
      vendor: defaults[component],
      region,
      health: "healthy",
      metadata: {
        replaceable: "true",
        strategy: "adapter-contract",
      },
    });
  }

  return registry;
}
