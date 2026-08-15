import type { BuilderRequest, HoareArtifact } from "./builder";

export type GovernanceDecision = "ALLOW" | "DENY";

export interface GovernanceResult {
  decision: GovernanceDecision;
  reason: string;
  tenantId: string;
  artifact: HoareArtifact;
  policy: {
    mode: "controlled" | "autonomous";
    allowedKinds: string[];
    maxCapabilities: number;
  };
}

const ALLOWED_KINDS = ["agent", "workflow", "service", "iot"] as const;
const MAX_CAPABILITIES = 50;

export function governResource(request: BuilderRequest, artifact: HoareArtifact): GovernanceResult {
  const tenantId = request.tenantId.trim();

  if (!tenantId || artifact.tenantId !== tenantId) {
    return deny("TENANT_ISOLATION_FAILED", tenantId, artifact);
  }

  if (!ALLOWED_KINDS.includes(artifact.kind)) {
    return deny("RESOURCE_KIND_NOT_ALLOWED", tenantId, artifact);
  }

  if (artifact.capabilities.length > MAX_CAPABILITIES) {
    return deny("CAPABILITY_LIMIT_EXCEEDED", tenantId, artifact);
  }

  if (artifact.mode === "autonomous" && artifact.kind === "iot") {
    return deny("AUTONOMOUS_IOT_REQUIRES_RUNTIME_POLICY", tenantId, artifact);
  }

  return {
    decision: "ALLOW",
    reason: "RESOURCE_GOVERNED",
    tenantId,
    artifact: { ...artifact, status: "DESIGNED" },
    policy: {
      mode: artifact.mode,
      allowedKinds: [...ALLOWED_KINDS],
      maxCapabilities: MAX_CAPABILITIES,
    },
  };
}

function deny(reason: string, tenantId: string, artifact: HoareArtifact): GovernanceResult {
  return {
    decision: "DENY",
    reason,
    tenantId,
    artifact,
    policy: {
      mode: artifact.mode,
      allowedKinds: [...ALLOWED_KINDS],
      maxCapabilities: MAX_CAPABILITIES,
    },
  };
}
