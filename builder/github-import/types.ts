export type RepositoryImportRequest = {
  tenant_id: string;
  project_id: string;
  repository: string;
  ref?: string;
};

export type RepositoryInventory = {
  repository: string;
  ref: string;
  detected: {
    languages: string[];
    frameworks: string[];
    package_managers: string[];
    workflows: string[];
    deployment_targets: string[];
  };
  files: string[];
  import_hash: string;
  provenance_hash: string;
};
