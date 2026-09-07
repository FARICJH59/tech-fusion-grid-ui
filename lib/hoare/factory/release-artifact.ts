import { createHash } from "node:crypto";
import type { NativeBuildResult } from "./build-executor";
import type { GeneratedWorkspaceFile } from "./application-execution";

export interface HoareReleaseArtifact {
  format: "hoare-release-v1";
  artifactDigest: string;
  sourceDigest: string;
  build: NativeBuildResult;
  files: Array<{ path: string; sha256: string }>;
}

export function createReleaseArtifact(
  files: GeneratedWorkspaceFile[],
  build: NativeBuildResult,
): HoareReleaseArtifact {
  return {
    format: "hoare-release-v1",
    artifactDigest: build.artifactDigest,
    sourceDigest: createHash("sha256")
      .update(JSON.stringify(files.map(({ path, content }) => ({ path, content })).sort((a, b) => a.path.localeCompare(b.path))))
      .digest("hex"),
    build,
    files: files.map(({ path, content }) => ({
      path,
      sha256: createHash("sha256").update(content).digest("hex"),
    })),
  };
}
