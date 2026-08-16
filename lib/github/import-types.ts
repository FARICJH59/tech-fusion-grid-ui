export type GitHubImportRequest = {
  tenantId: string;
  owner: string;
  repo: string;
  ref?: string;
};

export type GitHubRepositoryImport = {
  provider: "github";
  tenantId: string;
  owner: string;
  repo: string;
  ref: string;
  repositoryId: number;
  defaultBranch: string;
  private: boolean;
  cloneUrl: string;
  importedAt: string;
  provenanceHash: string;
};

export function assertPublicTenantId(tenantId: string): void {
  if (!/^ten_[a-f0-9]{32}$/.test(tenantId)) {
    throw new Error("Invalid public tenant ID");
  }
}
