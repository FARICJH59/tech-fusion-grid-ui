import { createHash } from "node:crypto";

export type ProjectInventory = {
  schema: "hoare.project-inventory/v1";
  tenant_id: string;
  project_id: string;
  source: {
    owner: string;
    repository: string;
    revision?: string;
    branch?: string;
  };
  detected: {
    languages: string[];
    frameworks: string[];
    package_managers: string[];
    build_systems: string[];
    deployment_targets: string[];
    has_aegisc: boolean;
    has_cpp: boolean;
    has_pasor: boolean;
    has_github_actions: boolean;
  };
  files: string[];
  provenance_hash: string;
};

const rules: Array<[RegExp, keyof ProjectInventory["detected"], string]> = [
  [/\\.rs$/i, "languages", "rust"],
  [/\\.(c|cc|cpp|cxx|h|hpp)$/i, "languages", "c_cpp"],
  [/\\.py$/i, "languages", "python"],
  [/\\.(ts|tsx)$/i, "languages", "typescript"],
  [/\\.(js|jsx)$/i, "languages", "javascript"],
  [/aegis(c|lang)?/i, "has_aegisc", "true"],
  [/pasor/i, "has_pasor", "true"],
  [/package(-lock)?\\.json$/i, "package_managers", "npm"],
  [/pnpm-lock\\.yaml$/i, "package_managers", "pnpm"],
  [/yarn\\.lock$/i, "package_managers", "yarn"],
  [/Cargo\\.toml$/i, "build_systems", "cargo"],
  [/CMakeLists\\.txt$/i, "build_systems", "cmake"],
  [/\.github[\\/]workflows[\\/]/i, "has_github_actions", "true"],
  [/next\\.config\\./i, "frameworks", "nextjs"],
  [/Dockerfile/i, "build_systems", "docker"],
];

export function buildProjectInventory(input: {
  tenant_id: string;
  project_id: string;
  owner: string;
  repository: string;
  revision?: string;
  branch?: string;
  files: string[];
}): ProjectInventory {
  const detected = {
    languages: [] as string[],
    frameworks: [] as string[],
    package_managers: [] as string[],
    build_systems: [] as string[],
    deployment_targets: [] as string[],
    has_aegisc: false,
    has_cpp: false,
    has_pasor: false,
    has_github_actions: false,
  };

  for (const file of input.files) {
    for (const [pattern, field, value] of rules) {
      if (!pattern.test(file)) continue;
      if (field.startsWith("has_")) {
        (detected[field] as boolean) = true;
      } else {
        const list = detected[field] as string[];
        if (!list.includes(value)) list.push(value);
      }
    }
  }
  detected.has_cpp ||= detected.languages.includes("c_cpp");

  const canonical = JSON.stringify({ ...input, detected, files: [...input.files].sort() });
  return {
    schema: "hoare.project-inventory/v1",
    tenant_id: input.tenant_id,
    project_id: input.project_id,
    source: {
      owner: input.owner,
      repository: input.repository,
      revision: input.revision,
      branch: input.branch,
    },
    detected,
    files: [...input.files].sort(),
    provenance_hash: createHash("sha256").update(canonical).digest("hex"),
  };
}
