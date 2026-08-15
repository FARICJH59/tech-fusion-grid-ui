import type { BuilderRequest, HoareArtifact } from "./builder";
import { governResource, type GovernanceResult } from "./control-plane";

export type BuilderAuthorizationResult = GovernanceResult & {
  authorized: boolean;
  action: "build";
};

/**
 * Single server-side gate for builder requests.
 * Identity/role authorization happens before this function; this gate owns
 * resource governance and guarantees the artifact remains tenant-bound.
 */
export function authorizeBuild(
  request: BuilderRequest,
  artifact: HoareArtifact,
): BuilderAuthorizationResult {
  const governance = governResource(request, artifact);

  return {
    ...governance,
    authorized: governance.decision === "ALLOW",
    action: "build",
  };
}
