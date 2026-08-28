import type {
  DomainResource,
  InfrastructureNode,
  TenantResource,
} from "./types";

export const DOMAIN_CATALOG: DomainResource[] = [
  "techfusional.com",
  "agenticfusionpro.com",
  "intentminers.com",
  "techfusional-ml.com",
  "techfusionalmltech.org",
  "brainfusionapi.com",
].map((hostname, index) => ({
  id: `domain-${index + 1}`,
  hostname,
  provider: "cloudflare",
  organizationId: "tech-fusion-ai-ml",
  verified: false,
  tlsManaged: false,
  status: "pending",
}));

export const NODE_CATALOG: InfrastructureNode[] = [
  {
    id: "hoare-node-001",
    name: "HOARE-NODE-001",
    kind: "bare-metal",
    provider: "bare-metal",
    region: "US",
    capabilities: [
      "containers",
      "vm",
      "storage",
      "networking",
      "observability",
    ],
    capacity: {
      cpu: 0,
      memoryGb: 0,
      storageGb: 0,
    },
    status: "provisioning",
  },
];

export const techFusionDomains = DOMAIN_CATALOG;

export const defaultPrivateCloudNode = NODE_CATALOG[0];

export function createTenant(
  input: Pick<
    TenantResource,
    | "id"
    | "organizationId"
    | "name"
    | "region"
    | "dataResidency"
    | "isolation"
  >,
): TenantResource {
  return {
    ...input,
    status: "provisioning",
  };
}
