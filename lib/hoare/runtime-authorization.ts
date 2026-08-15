import type { HoareArtifact } from "./builder";
import type { GovernanceResult } from "./control-plane";

export type RuntimeDecision = "ALLOW" | "DENY";

export interface RuntimeAuthorizationRequest {
  principalId: string;
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

const ACTION_BY_KIND: Record<HoareArtifact["kind"], RuntimeAuthorizationRequest["action"]> = {
  agent: "agent.create",
  workflow: "workflow.create",
  service: "service.create",
  iot: "iot.create",
};

export function authorizeRuntime(
  request: RuntimeAuthorizationRequest,
  governance: GovernanceResult,
): RuntimeAuthorizationResult {
  const base = {
    tenantId: request.tenantId,
    principalId: request.principalId,
    action: request.action,
    artifactId: request.artifact.id,
  };

  if (!request.principalId?.trim()) return { ...base, decision: "DENY", reason: "PRINCIPAL_REQUIRED" };
  if (!request.tenantId?.trim()) return { ...base, decision: "DENY", reason: "TENANT_REQUIRED" };
  if (request.tenantId !== governance.tenantId || request.tenantId !== request.artifact.tenantId) {
    return { ...base, decision: "DENY", reason: "TENANT_ISOLATION_FAILED" };
  }
  if (governance.decision !== "ALLOW") return { ...base, decision: "DENY", reason: `CONTROL_PLANE_${governance.reason}` };

  const expectedAction = ACTION_BY_KIND[request.artifact.kind];
  if (request.action !== expectedAction && request.action !== "resource.execute") {
    return { ...base, decision: "DENY", reason: "ACTION_RESOURCE_MISMATCH" };
  }

  return { ...base, decision: "ALLOW", reason: "RUNTIME_AUTHORIZED" };
}
