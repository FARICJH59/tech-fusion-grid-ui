export type AgentCapability = {
  name: string;
  version: string;
  description?: string;
};

export type AgentManifest = {
  id: string;
  name: string;
  version: string;
  tenantId: string;
  capabilities: AgentCapability[];
  status: "active" | "inactive" | "deprecated";
  createdAt: string;
};

export type AgentPackage = {
  packageId: string;
  agentId: string;
  version: string;
  checksum: string;
  publisher: string;
};

export type AgentPermission = {
  tenantId: string;
  agentId: string;
  permissions: string[];
};

export type CertificationRecord = {
  agentId: string;
  certified: boolean;
  reviewer: string;
  timestamp: string;
};
