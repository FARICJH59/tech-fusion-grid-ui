export type ServiceHealth = "healthy" | "degraded" | "down";

export type LayerName =
  | "control-plane"
  | "runtime"
  | "providers"
  | "infrastructure"
  | "agents"
  | "cloud"
  | "sdk"
  | "marketplace"
  | "security"
  | "revenue"
  | "defense-mission-service";

export type DeployableService = {
  name: string;
  layer: LayerName;
  endpoint: string;
  version: string;
  region: string;
  health: ServiceHealth;
};

export type TenantContext = {
  organizationId: string;
  tenantId: string;
  userId?: string;
};
