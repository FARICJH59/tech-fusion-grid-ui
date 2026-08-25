export type ProjectInventory = {
  schema: "hoare.project-inventory/v1";
  project_id: string;
  tenant_id: string;
  provenance_hash: string;
  detected: {
    languages: string[];
    frameworks: string[];
    has_github_actions: boolean;
    has_cpp: boolean;
    build_systems: string[];
    has_aegisc: boolean;
    has_pasor: boolean;
  };
};
