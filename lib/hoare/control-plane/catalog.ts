import type { DomainResource, InfrastructureNode, TenantResource } from "./types";

export const techFusionDomains: DomainResource[] = [
  "techfusional.com",
  "agenticfusionpro.com",
  "intentminers.com",
  "techfusional-ml.com",
  "techfusionalmltech.org",
  "brainfusionapi.com",
].map((hostname, index) => ({
  id: `domain-${index + 1}`,
  hostname,
  provider: "godaddy",
  organizationId: "tech-fusion-ai-ml",
  verified: false,
  tlsManaged: false,
  status: "pending",
}));

export const defaultPrivateCloudNode: InfrastructureNode = {
  id: "hoare-node-001",
  name: "HOARE-NODE-001",
  kind: "bare-metal",
  provider: "bare-metal",
  region: "US",
  capabilities: ["containers", "vm", "storage", "networking", "observability"],
  capacity: { cpu: 0, memoryGb: 0, storageGb: 0 },
  status: "provisioning",
};

export function createTenant(input: Pick<TenantResource, "id" | "organizationId" | "name" | "region" | "dataResidency" | "isolation">): TenantResource {
  return { ...input, status: "provisioning" };
}
