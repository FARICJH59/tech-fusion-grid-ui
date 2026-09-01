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
  "DIB Supply Chain",
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

function describeModule(name: string): string {
  if (name === "DIB Supply Chain") {
    return "Defense Industrial Base supply-chain graph, risk assessment, provenance gaps, resilience analysis, and governed response planning.";
  }
  return `${name} management for enterprise tenants and operators.`;
}

function layerForModule(name: string): DeployableService["layer"] {
  return name === "DIB Supply Chain" ? "defense-mission-service" : "control-plane";
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
      description: describeModule(moduleName),
      service: {
        name: `control-plane-${slug}`,
        layer: layerForModule(moduleName),
        endpoint: `/api/control-plane/${slug}`,
        version: "v1",
        region,
        health: "healthy",
      },
    });
  }
  return registry;
}
