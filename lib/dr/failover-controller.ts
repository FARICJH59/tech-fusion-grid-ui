export type RegionHealth = {
  region: string;
  healthy: boolean;
  latencyMs: number;
};

export type FailoverResult = {
  tenantId: string;
  primaryRegion: string;
  secondaryRegion: string;
  action: "evacuate" | "stay";
  validated: boolean;
};

export class FailoverController {
  orchestrate(input: {
    tenantId: string;
    primaryRegion: RegionHealth;
    secondaryRegion: RegionHealth;
  }): FailoverResult {
    const shouldEvacuate = !input.primaryRegion.healthy || input.primaryRegion.latencyMs > 1200;

    return {
      tenantId: input.tenantId,
      primaryRegion: input.primaryRegion.region,
      secondaryRegion: input.secondaryRegion.region,
      action: shouldEvacuate ? "evacuate" : "stay",
      validated: input.secondaryRegion.healthy,
    };
  }
}

export const failoverController = new FailoverController();
