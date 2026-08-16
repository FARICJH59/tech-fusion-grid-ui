import { createHash } from "node:crypto";
import type { GitHubImportRequest, GitHubRepositoryImport } from "./import-types";
import { assertPublicTenantId } from "./import-types";

type GitHubRepoResponse = {
  id: number;
  name: string;
  private: boolean;
  default_branch: string;
  clone_url: string;
};

/**
 * Server-side GitHub repository metadata importer.
 *
 * Authentication is deliberately supplied by the caller/runtime and never
 * persisted in the import record. In production this should be a short-lived
 * GitHub App installation token or OAuth token resolved from the tenant vault.
 */
export async function importGitHubRepository(
  request: GitHubImportRequest,
  accessToken: string,
  fetchImpl: typeof fetch = fetch,
): Promise<GitHubRepositoryImport> {
  assertPublicTenantId(request.tenantId);
  if (!accessToken) throw new Error("GitHub access token is required");
  if (!/^[A-Za-z0-9_.-]+$/.test(request.owner) || !/^[A-Za-z0-9_.-]+$/.test(request.repo)) {
    throw new Error("Invalid GitHub repository coordinates");
  }

  const response = await fetchImpl(
    `https://api.github.com/repos/${encodeURIComponent(request.owner)}/${encodeURIComponent(request.repo)}`,
    {
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${accessToken}`,
        "X-GitHub-Api-Version": "2022-11-28",
      },
    },
  );

  if (!response.ok) throw new Error(`GitHub repository lookup failed: HTTP ${response.status}`);

  const repository = (await response.json()) as GitHubRepoResponse;
  const ref = request.ref ?? repository.default_branch;
  const importedAt = new Date().toISOString();
  const provenanceHash = createHash("sha256")
    .update(JSON.stringify({
      provider: "github",
      tenantId: request.tenantId,
      repositoryId: repository.id,
      owner: request.owner,
      repo: repository.name,
      ref,
    }))
    .digest("hex");

  return {
    provider: "github",
    tenantId: request.tenantId,
    owner: request.owner,
    repo: repository.name,
    ref,
    repositoryId: repository.id,
    defaultBranch: repository.default_branch,
    private: repository.private,
    cloneUrl: repository.clone_url,
    importedAt,
    provenanceHash,
  };
}
