export const MARKETPLACE_EXTENSION_TYPES = [
  "Tools",
  "Agents",
  "Models",
  "Workflows",
  "Templates",
  "Industry Packs",
] as const;

export type MarketplaceExtensionType = (typeof MARKETPLACE_EXTENSION_TYPES)[number];

export type MarketplaceExtension = {
  id: string;
  type: MarketplaceExtensionType;
  name: string;
  version: string;
  publisher: string;
};

export class MarketplaceRegistry {
  private readonly extensions = new Map<string, MarketplaceExtension>();

  register(extension: MarketplaceExtension): void {
    this.extensions.set(extension.id, extension);
  }

  list(): MarketplaceExtension[] {
    return [...this.extensions.values()];
  }
}

export function createDefaultMarketplace(): MarketplaceRegistry {
  const registry = new MarketplaceRegistry();
  registry.register({
    id: "industry-pack-energy-v1",
    type: "Industry Packs",
    name: "Energy Grid Operations Pack",
    version: "1.0.0",
    publisher: "HOARE.ai",
  });
  return registry;
}
