export type ProviderKind = "godaddy" | "cloudflare" | "gcp" | "bare-metal" | "edge";
export type IsolationLevel = "shared" | "vm" | "dedicated-node" | "dedicated-server";
export type NodeKind = "cloud" | "bare-metal" | "edge";

export interface DomainResource {
  id: string;
  hostname: string;
  provider: ProviderKind;
  organizationId: string;
  verified: boolean;
  tlsManaged: boolean;
  status: "pending" | "active" | "error";
}

export interface TenantResource {
  id: string;
  organizationId: string;
  name: string;
  region: string;
  dataResidency: string;
  isolation: IsolationLevel;
  status: "provisioning" | "active" | "suspended";
}

export interface InfrastructureNode {
  id: string;
  name: string;
  kind: NodeKind;
  provider: ProviderKind;
  region: string;
  capabilities: string[];
  capacity: { cpu: number; memoryGb: number; storageGb: number; gpu?: number };
  status: "online" | "offline" | "draining" | "provisioning";
}

export interface ApplicationResource {
  id: string;
  tenantId: string;
  name: string;
  vertical: string;
  runtime: "container" | "vm" | "edge";
  desiredNodeId?: string;
  status: "draft" | "building" | "deploying" | "running" | "failed";
}
