import type { ApplicationResource, DomainResource, InfrastructureNode, TenantResource } from "./types";

export interface DeploymentPlan {
  id: string;
  tenantId: string;
  applicationId: string;
  nodeId: string;
  domainId?: string;
  steps: Array<"validate-tenant" | "validate-node" | "build" | "deploy" | "route-domain" | "health-check" | "meter">;
  status: "planned" | "ready" | "blocked";
  blockers: string[];
}

export function createDeploymentPlan(input: {
  tenant: TenantResource;
  application: ApplicationResource;
  node: InfrastructureNode;
  domain?: DomainResource;
}): DeploymentPlan {
  const blockers: string[] = [];

  if (input.tenant.status === "suspended") blockers.push("tenant-suspended");
  if (input.node.status !== "online") blockers.push("node-not-online");
  if (input.application.status === "failed") blockers.push("application-failed");
  if (input.domain && input.domain.status !== "active") blockers.push("domain-not-active");

  return {
    id: `deployment-${input.application.id}-${input.node.id}`,
    tenantId: input.tenant.id,
    applicationId: input.application.id,
    nodeId: input.node.id,
    domainId: input.domain?.id,
    steps: ["validate-tenant", "validate-node", "build", "deploy", "route-domain", "health-check", "meter"],
    status: blockers.length === 0 ? "ready" : "blocked",
    blockers,
  };
}
