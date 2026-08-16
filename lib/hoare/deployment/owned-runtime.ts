import { createHash } from "node:crypto";
import type { DeploymentManifest } from "./deployment-contract";

export interface RuntimeDeployment {
  deploymentId: string;
  applicationId: string;
  releaseDigest: string;
  runtime: "hoare-owned-runtime";
  entrypoint: string;
  healthPath: string;
  hostname?: string;
  status: "ready";
  runtimeDigest: string;
}

export function provisionOwnedRuntime(manifest: DeploymentManifest): RuntimeDeployment {
  if (manifest.target !== "owned-runtime") {
    throw new Error(`Owned runtime cannot provision target: ${manifest.target}`);
  }

  const runtimeDigest = createHash("sha256")
    .update(`${manifest.deploymentId}:${manifest.releaseDigest}`)
    .digest("hex");

  return {
    deploymentId: manifest.deploymentId,
    applicationId: manifest.applicationId,
    releaseDigest: manifest.releaseDigest,
    runtime: "hoare-owned-runtime",
    entrypoint: "frontend",
    healthPath: "/api/health",
    ...(manifest.hostname ? { hostname: manifest.hostname } : {}),
    status: "ready",
    runtimeDigest,
  };
}
