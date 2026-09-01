import type { ApplicationResource, DomainResource, InfrastructureNode, TenantResource } from "./types";

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

export const tenants: TenantResource[] = [];
export const applications: ApplicationResource[] = [];
export const infrastructureNodes: InfrastructureNode[] = [defaultPrivateCloudNode];

export function createTenant(input: Pick<TenantResource, "id" | "organizationId" | "name" | "region" | "dataResidency" | "isolation">): TenantResource {
  const tenant = { ...input, status: "provisioning" as const };
  tenants.push(tenant);
  return tenant;
}

export function registerApplication(resource: ApplicationResource): ApplicationResource {
  applications.push(resource);
  return resource;
}

export function registerInfrastructureNode(resource: InfrastructureNode): InfrastructureNode {
  infrastructureNodes.push(resource);
  return resource;
}

export function getTenant(id: string): TenantResource | null {
  return tenants.find((item) => item.id === id) ?? null;
}

export function getApplication(tenantId: string, name: string): ApplicationResource | null {
  return applications.find((item) => item.tenantId === tenantId && item.name === name) ?? null;
}

export function getInfrastructureNode(name: string): InfrastructureNode | null {
  return infrastructureNodes.find((item) => item.name === name) ?? null;
}
