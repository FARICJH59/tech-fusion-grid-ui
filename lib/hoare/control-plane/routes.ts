import { provisionTenant } from "./provisioning";
import { DOMAIN_CATALOG, NODE_CATALOG } from "./catalog";
import type { ApplicationResource, IsolationLevel } from "./types";

export type CreateTenantRequest = {
  organizationId: string;
  name: string;
  region: string;
  isolation: IsolationLevel;
};

export type CreateApplicationRequest = {
  tenantId: string;
  name: string;
  runtime: ApplicationResource["runtime"];
  domain?: string;
  vertical?: string;
  image?: string;
  desiredNodeId?: string;
};

export function listControlPlaneResources() {
  return {
    domains: DOMAIN_CATALOG,
    nodes: NODE_CATALOG,
  };
}

export function createTenant(request: CreateTenantRequest) {
  return provisionTenant({
    id: `tenant_${request.organizationId}_${request.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
    organizationId: request.organizationId,
    name: request.name,
    region: request.region,
    isolation: request.isolation,
  });
}

export function createApplication(
  request: CreateApplicationRequest,
): ApplicationResource {
  return {
    id: `app_${request.tenantId}_${request.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
    tenantId: request.tenantId,
    name: request.name,
    vertical: request.vertical ?? "general",
    runtime: request.runtime,
    image: request.image,
    desiredNodeId: request.desiredNodeId,
    status: "draft",
  };
}
