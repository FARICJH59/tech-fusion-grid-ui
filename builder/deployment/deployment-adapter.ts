export type DeploymentTarget = "cloud-run" | "local" | "edge";

export interface DeploymentRequest {
  unitId: string;
  commandId: string;
  artifactPath: string;
  artifactSha256: string;
  provenanceHash: string;
  target: DeploymentTarget;
  serviceName?: string;
  region?: string;
  image?: string;
  environment?: Record<string, string>;
}

export interface DeploymentResult {
  unitId: string;
  target: DeploymentTarget;
  accepted: boolean;
  deploymentId?: string;
  endpoint?: string;
  message: string;
}

export interface DeploymentAdapter {
  readonly target: DeploymentTarget;
  deploy(request: DeploymentRequest): Promise<DeploymentResult>;
}

export function assertAttested(request: DeploymentRequest): void {
  if (!request.unitId || !request.commandId) throw new Error("DEPLOYMENT_IDENTITY_REQUIRED");
  if (!/^[a-f0-9]{64}$/i.test(request.artifactSha256)) throw new Error("ARTIFACT_HASH_REQUIRED");
  if (!/^[a-f0-9]{64}$/i.test(request.provenanceHash)) throw new Error("PROVENANCE_HASH_REQUIRED");
}
