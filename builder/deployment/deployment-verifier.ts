import { createHash } from "node:crypto";

export type DeploymentVerificationInput = {
  unitId: string;
  deploymentId: string;
  artifactSha256: string;
  provenanceHash: string;
  expectedRevision?: string;
  observedRevision: string;
  healthy: boolean;
};

export type DeploymentVerification = {
  verified: boolean;
  reason: string;
  verificationHash: string;
};

export function verifyDeployment(input: DeploymentVerificationInput): DeploymentVerification {
  const verificationHash = createHash("sha256")
    .update(JSON.stringify(input))
    .digest("hex");

  if (!input.healthy) return { verified: false, reason: "HEALTH_CHECK_FAILED", verificationHash };
  if (input.expectedRevision && input.expectedRevision !== input.observedRevision) {
    return { verified: false, reason: "REVISION_MISMATCH", verificationHash };
  }
  if (!/^[a-f0-9]{64}$/i.test(input.artifactSha256)) {
    return { verified: false, reason: "ARTIFACT_HASH_INVALID", verificationHash };
  }
  if (!/^[a-f0-9]{64}$/i.test(input.provenanceHash)) {
    return { verified: false, reason: "PROVENANCE_HASH_INVALID", verificationHash };
  }

  return { verified: true, reason: "DEPLOYMENT_VERIFIED", verificationHash };
}
