import { createDefaultFleetManager } from "@/lib/enterprise/fleet";
import { hoareEnterprisePlatform } from "@/lib/enterprise/platform";

export type OperationsSnapshot = {
  timestamp: string;
  fleetStatus: { region: string; healthy: boolean }[];
  deploymentStatus: { runtimeHealth: string; controlPlaneHealth: string };
  telemetry: { providers: number; runtimeServices: number };
  incidents: { open: number };
  runtimeEvents: { queueDepth: number };
  workflowExecution: { active: number };
  aiProviderStatus: { name: string; health: string }[];
};

const fleetManager = createDefaultFleetManager();

export function createOperationsSnapshot(): OperationsSnapshot {
  const platform = hoareEnterprisePlatform.status();
  const runtimeServices = hoareEnterprisePlatform.runtime.list();

  return {
    timestamp: new Date().toISOString(),
    fleetStatus: fleetManager.snapshot().map((item) => ({ region: item.region, healthy: item.healthy })),
    deploymentStatus: {
      runtimeHealth: platform.health.runtime,
      controlPlaneHealth: platform.health.controlPlane,
    },
    telemetry: {
      providers: platform.architecture.providers.length,
      runtimeServices: runtimeServices.length,
    },
    incidents: {
      open: runtimeServices.filter((item) => item.health !== "healthy").length,
    },
    runtimeEvents: { queueDepth: 0 },
    workflowExecution: { active: runtimeServices.filter((item) => item.health === "healthy").length },
    aiProviderStatus: hoareEnterprisePlatform.providers
      .list()
      .map((provider) => ({ name: provider.name, health: provider.health })),
  };
}
