import crypto from "node:crypto";

export type GitHubRepositoryReference = {
  url: string;
  ref?: string;
  tenant_id: string;
  project_id: string;
};

export type GitHubImportPlan = {
  source: { provider: "github"; owner: string; repository: string; ref?: string };
  tenant_id: string;
  project_id: string;
  inspection_unit_id: string;
  provenance_hash: string;
  execution_required: false;
};

const GITHUB_URL = /^https:\/\/github\.com\/([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+?)(?:\.git)?\/?$/;

function hash(value: unknown): string {
  return crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

/**
 * Converts a GitHub repository reference into a read-only inspection plan.
 * Importing a repository never executes its code. Build/deploy remains a
 * separate PASOR-governed phase.
 */
export function createGitHubImportPlan(input: GitHubRepositoryReference): GitHubImportPlan {
  if (!input.tenant_id || !input.project_id) throw new Error("TENANT_PROJECT_REQUIRED");
  const match = input.url.match(GITHUB_URL);
  if (!match) throw new Error("UNSUPPORTED_GITHUB_URL");

  const source = { provider: "github" as const, owner: match[1], repository: match[2], ...(input.ref ? { ref: input.ref } : {}) };
  return {
    source,
    tenant_id: input.tenant_id,
    project_id: input.project_id,
    inspection_unit_id: "github.inspect_repository",
    provenance_hash: hash({ source, tenant_id: input.tenant_id, project_id: input.project_id }),
    execution_required: false,
  };
}
