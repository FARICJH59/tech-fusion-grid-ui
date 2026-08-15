import type { HoareArtifact } from "./builder";
import type { GovernanceResult } from "./control-plane";
import { authorizePrincipal, type HoarePrincipal, type Permission } from "./iam";

export type RuntimeDecision = "ALLOW" | "DENY";

export interface RuntimeAuthorizationRequest {
  principal: HoarePrincipal;
  tenantId: string;
  action: "agent.create" | "workflow.create" | "service.create" | "iot.create" | "resource.execute";
  artifact: HoareArtifact;
}

export interface RuntimeAuthorizationResult {
  decision: RuntimeDecision;
  reason: string;
  tenantId: string;
  principalId: string;
  action: RuntimeAuthorizationRequest["action"];
  artifactId: string;
}

const ACTION_BY_KIND: Record<HoareArtifact["kind"], Permission> = {
  agent: "agent.create",
  workflow: "workflow.create",
  service: "system.manage",
  iot: "cloud.deploy",
};

const EXECUTE_PERMISSION: Record<HoareArtifact["kind"], Permission> = {
  agent: "agent.execute",
  workflow: "workflow.execute",
  service: "cloud.deploy",
  iot: "cloud.deploy",
};

export function authorizeRuntime(
  request: RuntimeAuthorizationRequest,
  governance: GovernanceResult,
): RuntimeAuthorizationResult {
  const base = {
    tenantId: request.tenantId,
    principalId: request.principal.id,
    action: request.action,
    artifactId: request.artifact.id,
  };

  if (!request.principal.id?.trim()) return { ...base, decision: "DENY", reason: "PRINCIPAL_REQUIRED" };
  if (!request.tenantId?.trim()) return { ...base, decision: "DENY", reason: "TENANT_REQUIRED" };
  if (request.tenantId !== governance.tenantId || request.tenantId !== request.artifact.tenantId) {
    return { ...base, decision: "DENY", reason: "TENANT_ISOLATION_FAILED" };
  }
  if (governance.decision !== "ALLOW") return { ...base, decision: "DENY", reason: `CONTROL_PLANE_${governance.reason}` };

  const permission = request.action === "resource.execute"
    ? EXECUTE_PERMISSION[request.artifact.kind]
    : ACTION_BY_KIND[request.artifact.kind];

  if (request.action !== "resource.execute" && request.action !== permission) {
    return { ...base, decision: "DENY", reason: "ACTION_RESOURCE_MISMATCH" };
  }

  const iam = authorizePrincipal(request.principal, request.tenantId, permission);
  if (!iam.allowed) return { ...base, decision: "DENY", reason: iam.reason };

  return { ...base, decision: "ALLOW", reason: "RUNTIME_AUTHORIZED" };
}
