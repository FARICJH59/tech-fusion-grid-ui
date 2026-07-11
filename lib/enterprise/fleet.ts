export type RegionCapacity = {
  region: string;
  healthy: boolean;
  capacityUnits: number;
  edgeEnabled: boolean;
};

export type FleetPlacementRequest = {
  tenantId: string;
  requiredCapacity: number;
  latencySensitive: boolean;
  preferredRegions?: string[];
};

export type FleetPlacement = {
  primary: string;
  failover: string;
  strategy: "balanced" | "edge-first" | "capacity-first";
};

export class FleetManager {
  constructor(private readonly regions: RegionCapacity[]) {}

  snapshot(): RegionCapacity[] {
    return this.regions;
  }

  placeWorkload(request: FleetPlacementRequest): FleetPlacement {
    const healthy = this.regions.filter((region) => region.healthy);
    const candidates =
      request.preferredRegions && request.preferredRegions.length > 0
        ? healthy.filter((item) => request.preferredRegions?.includes(item.region))
        : healthy;

    const sorted = [...(candidates.length > 0 ? candidates : healthy)].sort(
      (a, b) => b.capacityUnits - a.capacityUnits,
    );

    const primary =
      request.latencySensitive
        ? sorted.find((item) => item.edgeEnabled && item.capacityUnits >= request.requiredCapacity) ??
          sorted[0]
        : sorted[0];

    const failover = sorted.find((item) => item.region !== primary.region) ?? primary;

    return {
      primary: primary.region,
      failover: failover.region,
      strategy: request.latencySensitive ? "edge-first" : "balanced",
    };
  }
}

export function createDefaultFleetManager(): FleetManager {
  return new FleetManager([
    { region: "us-central1", healthy: true, capacityUnits: 120, edgeEnabled: true },
    { region: "us-east1", healthy: true, capacityUnits: 100, edgeEnabled: true },
    { region: "europe-west1", healthy: true, capacityUnits: 80, edgeEnabled: true },
    { region: "asia-south1", healthy: true, capacityUnits: 70, edgeEnabled: true },
  ]);
}
