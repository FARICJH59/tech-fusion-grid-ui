import { provisionTenant } from './provisioning';
import { DOMAIN_CATALOG, NODE_CATALOG } from './catalog';
import type { Application, IsolationLevel } from './types';

export type CreateTenantRequest = {
  organizationId: string;
  name: string;
  region: string;
  isolation: IsolationLevel;
};

export type CreateApplicationRequest = {
  tenantId: string;
  name: string;
  runtime: "container" | "vm" | "edge";
  domain?: string;
};

export function listControlPlaneResources() {
  return {
    domains: DOMAIN_CATALOG,
    nodes: NODE_CATALOG,
  };
}

export function createTenant(request: CreateTenantRequest) {
  return provisionTenant({
    id: `tenant_${request.organizationId}_${request.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
    organizationId: request.organizationId,
    name: request.name,
    region: request.region,
    dataResidency: request.region,
    isolation: request.isolation,
    status: "provisioning",
  });
}

export function createApplication(request: CreateApplicationRequest): Application {
  return {
    id: `app_${request.tenantId}_${request.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
    tenantId: request.tenantId,
    name: request.name,
    vertical: "saas",
    runtime: request.runtime,

    status: "draft",
  };
}
