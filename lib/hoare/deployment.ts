import crypto from "crypto";
import type { BuilderRequest, HoareArtifact } from "./builder";
import { governResource } from "./control-plane";

export type DeploymentTarget = "cloud" | "edge" | "pi" | "jetson" | "local";

export interface DeploymentRequest {
  tenantId: string;
  artifact: HoareArtifact;
  target: DeploymentTarget;
}

export interface DeploymentResult {
  decision: "ALLOW" | "DENY";
  reason: string;
  deploymentId: string;
  tenantId: string;
  target: DeploymentTarget;
  artifact: HoareArtifact;
  release: { status: "APPROVED" | "REJECTED"; version: string; digest: string };
}

export function deployResource(request: DeploymentRequest): DeploymentResult {
  const artifact = request.artifact;
  const tenantId = request.tenantId.trim();
  const builderRequest: BuilderRequest = {
    tenantId,
    name: artifact.name,
    kind: artifact.kind,
    description: artifact.description,
    capabilities: artifact.capabilities,
    mode: artifact.mode,
    runtime: artifact.runtime,
  };

  if (artifact.tenantId !== tenantId) return reject(request, "TENANT_ISOLATION_FAILED");

  const governance = governResource(builderRequest, artifact);
  if (governance.decision !== "ALLOW") return reject(request, governance.reason);

  if (artifact.status !== "DESIGNED" && artifact.status !== "APPROVED") {
    return reject(request, "ARTIFACT_NOT_DEPLOYABLE");
  }

  const digest = crypto.createHash("sha256").update(JSON.stringify({ artifact, target: request.target })).digest("hex");
  return {
    decision: "ALLOW",
    reason: "DEPLOYMENT_APPROVED",
    deploymentId: crypto.randomUUID(),
    tenantId,
    target: request.target,
    artifact: { ...artifact, status: "APPROVED" },
    release: { status: "APPROVED", version: artifact.version, digest },
  };
}

function reject(request: DeploymentRequest, reason: string): DeploymentResult {
  const digest = crypto.createHash("sha256").update(JSON.stringify({ artifact: request.artifact, target: request.target })).digest("hex");
  return {
    decision: "DENY",
    reason,
    deploymentId: crypto.randomUUID(),
    tenantId: request.tenantId,
    target: request.target,
    artifact: request.artifact,
    release: { status: "REJECTED", version: request.artifact.version, digest },
  };
}
