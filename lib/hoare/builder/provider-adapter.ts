import type { ResourceInventoryRecord } from "./resource-inventory";

export interface CapabilityDiscoveryContext {
  tenantId: string;
  environment: "development" | "staging" | "production";
  region?: string;
  securityDomain?: string;
}

export interface ProviderCapabilityAdapter {
  readonly provider: string;
  discover(context: CapabilityDiscoveryContext): Promise<readonly ResourceInventoryRecord[]>;
}

export class StaticCapabilityAdapter implements ProviderCapabilityAdapter {
  readonly provider: string;

  constructor(provider: string, private readonly records: readonly ResourceInventoryRecord[]) {
    this.provider = provider;
  }

  async discover(context: CapabilityDiscoveryContext): Promise<readonly ResourceInventoryRecord[]> {
    return this.records.filter(
      (record) => record.environment === context.environment &&
        (!context.region || record.region === context.region),
    );
  }
}
