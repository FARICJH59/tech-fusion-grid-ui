export const CAPABILITY_TYPES = [
  "reasoning",
  "retrieval",
  "generation",
  "automation",
  "analysis",
  "recommendation",
  "execution",
] as const;

export type CapabilityType = (typeof CAPABILITY_TYPES)[number];

export type CapabilityDefinition = {
  id: string;
  name: string;
  description: string;
  type: CapabilityType;
  version: string;
  actions: string[];
  tools?: string[];
  workflows?: string[];
  metadata?: Record<string, unknown>;
};

export type CapabilityDiscoveryFilters = {
  type?: CapabilityType;
  action?: string;
  tool?: string;
  workflow?: string;
};

export type CapabilityValidationResult = {
  valid: boolean;
  missing: string[];
  duplicates: string[];
};

export class CapabilityRegistry {
  private readonly capabilities = new Map<string, CapabilityDefinition[]>();

  register(capability: CapabilityDefinition): void {
    const versions = this.capabilities.get(capability.id) ?? [];
    if (versions.some((existing) => existing.version === capability.version)) {
      throw new Error(`Capability '${capability.id}' version '${capability.version}' is already registered.`);
    }

    versions.push(capability);
    versions.sort((left, right) => right.version.localeCompare(left.version, undefined, { numeric: true }));
    this.capabilities.set(capability.id, versions);
  }

  discover(filters: CapabilityDiscoveryFilters = {}): CapabilityDefinition[] {
    return [...this.capabilities.values()]
      .flat()
      .filter((capability) => (filters.type ? capability.type === filters.type : true))
      .filter((capability) => (filters.action ? capability.actions.includes(filters.action) : true))
      .filter((capability) => (filters.tool ? capability.tools?.includes(filters.tool) : true))
      .filter((capability) => (filters.workflow ? capability.workflows?.includes(filters.workflow) : true));
  }

  listVersions(capabilityId: string): CapabilityDefinition[] {
    return [...(this.capabilities.get(capabilityId) ?? [])];
  }

  latest(capabilityId: string): CapabilityDefinition | undefined {
    return this.listVersions(capabilityId)[0];
  }

  validate(requiredCapabilityIds: string[]): CapabilityValidationResult {
    const missing = requiredCapabilityIds.filter((id) => !this.capabilities.has(id));
    const duplicates = [...this.capabilities.entries()]
      .filter(([, versions]) => new Set(versions.map((item) => item.version)).size !== versions.length)
      .map(([id]) => id);

    return {
      valid: missing.length === 0 && duplicates.length === 0,
      missing,
      duplicates,
    };
  }
}
