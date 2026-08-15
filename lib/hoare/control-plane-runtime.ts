import type { BuilderRequest } from "./builder";
import { buildResource, type HoareArtifact } from "./builder";
import { governResource, type GovernanceResult } from "./control-plane";
import { authorizeRuntime, type RuntimeAuthorizationResult, type RuntimeAuthorizationRequest } from "./runtime-authorization";
import type { HoarePrincipal } from "./iam";

export interface GovernedBuildResult {
  artifact: HoareArtifact;
  governance: GovernanceResult;
  runtime: RuntimeAuthorizationResult;
}

export function buildGovernedRuntimeResource(
  request: BuilderRequest,
  principal: HoarePrincipal,
  action?: RuntimeAuthorizationRequest["action"],
): GovernedBuildResult {
  const artifact = buildResource(request);
  const runtimeAction = action || `${artifact.kind}.create` as RuntimeAuthorizationRequest["action"];
  const governance = governResource(request, artifact);
  const runtime = authorizeRuntime(
    {
      principal,
      tenantId: request.tenantId,
      action: runtimeAction,
      artifact,
    },
    governance,
  );

  return { artifact, governance, runtime };
}
