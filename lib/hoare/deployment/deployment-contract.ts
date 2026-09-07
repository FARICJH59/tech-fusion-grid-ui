import { createHash } from "node:crypto";

export type DeploymentTarget = "owned-runtime" | "cloudflare" | "cloud" | "edge" | "local";

export interface DeploymentIntent {
  tenantId: string;
  projectId: string;
  applicationId: string;
  releaseDigest: string;
  target?: DeploymentTarget;
  domain?: string;
}

export interface DeploymentManifest {
  version: "1";
  deploymentId: string;
  tenantId: string;
  projectId: string;
  applicationId: string;
  releaseDigest: string;
  target: DeploymentTarget;
  hostname?: string;
  status: "planned" | "ready";
  controlPlane: "hoare";
  edgeAdapter: "cloudflare" | "none";
}

const ROOT_DOMAIN = process.env.HOARE_ROOT_DOMAIN?.trim().toLowerCase();

function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 63) || "app";
}

function hash(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function hostnameFor(intent: DeploymentIntent): string | undefined {
  if (intent.domain) return intent.domain.toLowerCase();
  if (!ROOT_DOMAIN) return undefined;
  return `${slug(intent.tenantId)}--${slug(intent.projectId)}.${ROOT_DOMAIN}`;
}

export function createDeploymentManifest(intent: DeploymentIntent): DeploymentManifest {
  if (!intent.tenantId || !intent.projectId || !intent.applicationId || !intent.releaseDigest) {
    throw new Error("tenantId, projectId, applicationId, and releaseDigest are required");
  }

  const target = intent.target ?? "owned-runtime";
  const hostname = hostnameFor(intent);
  const seed = `${intent.tenantId}:${intent.projectId}:${intent.applicationId}:${intent.releaseDigest}:${target}:${hostname ?? ""}`;

  return {
    version: "1",
    deploymentId: `dep_${hash(seed).slice(0, 24)}`,
    tenantId: intent.tenantId,
    projectId: intent.projectId,
    applicationId: intent.applicationId,
    releaseDigest: intent.releaseDigest,
    target,
    ...(hostname ? { hostname } : {}),
    status: "planned",
    controlPlane: "hoare",
    edgeAdapter: target === "cloudflare" || hostname ? "cloudflare" : "none",
  };
}

export function validateDeploymentManifest(manifest: DeploymentManifest): void {
  if (manifest.version !== "1") throw new Error("Unsupported deployment manifest version");
  if (!/^dep_[a-f0-9]{24}$/.test(manifest.deploymentId)) throw new Error("Invalid deployment id");
  if (manifest.controlPlane !== "hoare") throw new Error("Deployment must remain HOARE-controlled");
  if (manifest.target === "owned-runtime" && manifest.edgeAdapter === "cloudflare" && !manifest.hostname) {
    throw new Error("Cloudflare edge binding requires a hostname");
  }
}

export function markDeploymentReady(manifest: DeploymentManifest): DeploymentManifest {
  validateDeploymentManifest(manifest);
  return { ...manifest, status: "ready" };
}
