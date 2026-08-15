import type { ApplicationResource, InfrastructureNode, TenantResource } from "./types";

export interface ProvisioningPlan {
  tenant: TenantResource;
  application: ApplicationResource;
  node: InfrastructureNode;
  steps: string[];
}

export function planProvisioning(
  tenant: TenantResource,
  application: ApplicationResource,
  node: InfrastructureNode,
): ProvisioningPlan {
  if (tenant.region !== node.region) {
    throw new Error(`Tenant region ${tenant.region} does not match node region ${node.region}`);
  }

  const steps = [
    "validate-tenant-policy",
    "allocate-isolated-network",
    "allocate-storage",
    "register-identity",
    "deploy-application",
    "configure-domain-route",
    "enable-observability",
    "enable-metering",
    "health-check",
  ];

  if (tenant.isolation === "dedicated-server") steps.splice(1, 0, "reserve-dedicated-server");
  if (tenant.isolation === "dedicated-node") steps.splice(1, 0, "reserve-dedicated-node");

  return { tenant, application, node, steps };
}
