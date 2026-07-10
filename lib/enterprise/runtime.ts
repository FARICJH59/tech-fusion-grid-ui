import type { DeployableService, ServiceHealth } from "@/lib/enterprise/types";

export const RUNTIME_SERVICES = [
  "Runtime Supervisor",
  "Workflow Engine",
  "Scheduler",
  "Dispatcher",
  "Event Bus",
  "Health Manager",
  "Auto Remediation",
  "Agent Registry",
  "MCP Gateway",
  "SDK Manager",
  "Tool Registry",
  "Plugin Manager",
] as const;

export type RuntimeServiceName = (typeof RUNTIME_SERVICES)[number];

export type RuntimeService = DeployableService & {
  runtimeName: RuntimeServiceName;
  dependencies: string[];
  independentlyDeployable: true;
};

export class RuntimeIntegration {
  private readonly services = new Map<RuntimeServiceName, RuntimeService>();

  constructor(region = "global") {
    for (const name of RUNTIME_SERVICES) {
      const key = name.toLowerCase().replace(/\s+/g, "-");
      this.services.set(name, {
        name: `hoare-runtime-${key}`,
        runtimeName: name,
        layer: "runtime",
        endpoint: `/api/runtime/${key}`,
        version: "v1",
        region,
        health: "healthy",
        dependencies: key === "event-bus" ? [] : ["Event Bus"],
        independentlyDeployable: true,
      });
    }
  }

  list(): RuntimeService[] {
    return [...this.services.values()];
  }

  setHealth(name: RuntimeServiceName, health: ServiceHealth): void {
    const current = this.services.get(name);
    if (!current) return;
    this.services.set(name, { ...current, health });
  }

  getHealth(): ServiceHealth {
    const statuses = this.list().map((service) => service.health);
    if (statuses.includes("down")) return "down";
    if (statuses.includes("degraded")) return "degraded";
    return "healthy";
  }
}
