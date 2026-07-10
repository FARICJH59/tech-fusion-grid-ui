import type { DeployableService, ServiceHealth } from "@/lib/enterprise/types";

export const CONTROL_PLANE_MODULES = [
  "Organizations",
  "Tenants",
  "Users",
  "Projects",
  "Workspaces",
  "AI Providers",
  "Infrastructure",
  "Billing",
  "Security",
  "Observability",
  "Deployment",
  "Marketplace",
] as const;

export type ControlPlaneModule = {
  name: (typeof CONTROL_PLANE_MODULES)[number];
  slug: string;
  description: string;
  service: DeployableService;
};

function toSlug(name: string): string {
  return name.toLowerCase().replace(/\s+/g, "-");
}

export class ControlPlaneRegistry {
  private readonly modules = new Map<string, ControlPlaneModule>();

  register(module: ControlPlaneModule): void {
    this.modules.set(module.slug, module);
  }

  list(): ControlPlaneModule[] {
    return [...this.modules.values()].sort((a, b) => a.name.localeCompare(b.name));
  }

  get(slug: string): ControlPlaneModule | null {
    return this.modules.get(slug) ?? null;
  }

  snapshotHealth(): ServiceHealth {
    const statuses = this.list().map((module) => module.service.health);
    if (statuses.includes("down")) return "down";
    if (statuses.includes("degraded")) return "degraded";
    return "healthy";
  }
}

export function buildDefaultControlPlane(region = "global"): ControlPlaneRegistry {
  const registry = new ControlPlaneRegistry();
  for (const moduleName of CONTROL_PLANE_MODULES) {
    const slug = toSlug(moduleName);
    registry.register({
      name: moduleName,
      slug,
      description: `${moduleName} management for enterprise tenants and operators.`,
      service: {
        name: `control-plane-${slug}`,
        layer: "control-plane",
        endpoint: `/api/control-plane/${slug}`,
        version: "v1",
        region,
        health: "healthy",
      },
    });
  }
  return registry;
}
