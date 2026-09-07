import { createTenant as registerTenant, techFusionDomains, infrastructureNodes } from "./catalog";
import type { ApplicationResource, IsolationLevel, NodeKind } from "./types";

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
  vertical?: string;
};

export function listControlPlaneResources() {
  return {
    domains: techFusionDomains,
    nodes: infrastructureNodes,
  };
}

export function createTenant(request: CreateTenantRequest) {
  return registerTenant({
    id: `tenant_${request.organizationId}_${request.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
    organizationId: request.organizationId,
    name: request.name,
    region: request.region,
    dataResidency: request.region,
    isolation: request.isolation,
  });
}

export function createApplication(request: CreateApplicationRequest): ApplicationResource {
  const runtime = request.runtime;
  const application: ApplicationResource = {
    id: `app_${request.tenantId}_${request.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
    tenantId: request.tenantId,
    name: request.name,
    vertical: request.vertical ?? "general",
    runtime,
    status: "draft",
  };
  return application;
}
