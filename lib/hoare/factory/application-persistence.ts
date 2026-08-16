import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

export type GeneratedApplicationArtifact = {
  path: string;
  content: string;
};

export type PersistedApplication = {
  applicationId: string;
  rootDirectory: string;
  files: string[];
  artifactDigest: string;
};

function digestArtifacts(artifacts: GeneratedApplicationArtifact[]): string {
  const canonical = artifacts
    .map(({ path: filePath, content }) => ({ path: filePath, content }))
    .sort((a, b) => a.path.localeCompare(b.path));

  return createHash("sha256").update(JSON.stringify(canonical)).digest("hex");
}

export async function persistApplicationArtifacts(
  applicationId: string,
  artifacts: GeneratedApplicationArtifact[],
  rootDirectory = path.join(process.cwd(), ".hoare", "applications"),
): Promise<PersistedApplication> {
  if (!applicationId || !/^[a-zA-Z0-9._-]+$/.test(applicationId)) {
    throw new Error("Invalid applicationId");
  }

  const applicationRoot = path.join(rootDirectory, applicationId);
  const normalized = artifacts.map((artifact) => ({
    path: artifact.path.replace(/^\/+/, ""),
    content: artifact.content,
  }));

  for (const artifact of normalized) {
    if (!artifact.path || artifact.path.includes("..")) {
      throw new Error(`Unsafe application artifact path: ${artifact.path}`);
    }

    const target = path.join(applicationRoot, artifact.path);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, artifact.content, "utf8");
  }

  return {
    applicationId,
    rootDirectory: applicationRoot,
    files: normalized.map((artifact) => artifact.path),
    artifactDigest: digestArtifacts(normalized),
  };
}
