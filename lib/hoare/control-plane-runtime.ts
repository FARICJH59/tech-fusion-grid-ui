import type { BuilderRequest } from "./builder";
import { buildResource, type HoareArtifact } from "./builder";
import { governResource, type GovernanceResult } from "./control-plane";
import { authorizeRuntime, type RuntimeAuthorizationResult, type RuntimeAuthorizationRequest } from "./runtime-authorization";

export interface GovernedBuildResult {
  artifact: HoareArtifact;
  governance: GovernanceResult;
  runtime: RuntimeAuthorizationResult;
}

export function buildGovernedRuntimeResource(
  request: BuilderRequest,
  principalId: string,
  action?: RuntimeAuthorizationRequest["action"],
): GovernedBuildResult {
  const artifact = buildResource(request);
  const governance = governResource(request, artifact);
  const runtime = authorizeRuntime(
    {
      principalId,
      tenantId: request.tenantId,
      action: action || `${artifact.kind}.create` as RuntimeAuthorizationRequest["action"],
      artifact,
    },
    governance,
  );

  return { artifact, governance, runtime };
}
