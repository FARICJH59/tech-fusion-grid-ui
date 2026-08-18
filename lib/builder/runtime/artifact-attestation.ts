import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import type { ExecutionUnit } from "../pasor/brain-adapter";

export interface ArtifactAttestation {
  unit_id: string;
  command_id: string;
  artifact_path: string;
  artifact_sha256: string;
  provenance_hash: string;
  attestation_hash: string;
  verified: true;
}

export async function attestArtifact(
  unit: ExecutionUnit,
  artifactPath: string,
  provenanceHash: string,
): Promise<ArtifactAttestation> {
  const bytes = await readFile(artifactPath);
  const artifactSha256 = createHash("sha256").update(bytes).digest("hex");
  const attestationHash = createHash("sha256")
    .update(JSON.stringify({
      unit_id: unit.unit_id,
      command_id: unit.command_id,
      artifact_path: artifactPath,
      artifact_sha256: artifactSha256,
      provenance_hash: provenanceHash,
    }))
    .digest("hex");

  return {
    unit_id: unit.unit_id,
    command_id: unit.command_id,
    artifact_path: artifactPath,
    artifact_sha256: artifactSha256,
    provenance_hash: provenanceHash,
    attestation_hash: attestationHash,
    verified: true,
  };
}
