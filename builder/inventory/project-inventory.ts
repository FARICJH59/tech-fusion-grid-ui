import { createHash } from "node:crypto";

export type ProjectInventoryInput = Readonly<{
  tenant_id: string;
  project_id: string;
  owner: string;
  repository: string;
  revision: string;
  files: readonly string[];
}>;

export type ProjectInventoryDetected = Readonly<{
  languages: string[];
  frameworks: string[];
  build_systems: string[];
  has_github_actions: boolean;
  has_cpp: boolean;
  has_aegisc: boolean;
  has_pasor: boolean;
}>;

export type ProjectInventory = Readonly<ProjectInventoryInput & {
  schema: "hoare.project-inventory/v1";
  detected: ProjectInventoryDetected;
  inventory_hash: string;
  provenance_hash: string;
}>;

function detect(files: readonly string[]): ProjectInventoryDetected {
  const lower = files.map((file) => file.toLowerCase());
  const languages = new Set<string>();
  if (lower.some((file) => /(^|\.)tsx?$/.test(file) || file.endsWith(".mjs") || file.endsWith(".cjs"))) languages.add("typescript/javascript");
  if (lower.some((file) => file.endsWith(".py"))) languages.add("python");
  if (lower.some((file) => file.endsWith(".rs"))) languages.add("rust");
  if (lower.some((file) => file.endsWith(".cpp") || file.endsWith(".cc") || file.endsWith(".cxx") || file.endsWith(".h") || file.endsWith(".hpp"))) languages.add("cpp");

  const frameworks = new Set<string>();
  if (lower.some((file) => file.endsWith("package.json"))) frameworks.add("node");
  if (lower.some((file) => file.includes("next.config."))) frameworks.add("nextjs");
  if (lower.some((file) => file.endsWith("pyproject.toml") || file.endsWith("requirements.txt"))) frameworks.add("python");

  const buildSystems = new Set<string>();
  if (lower.some((file) => file.endsWith("cmakelists.txt"))) buildSystems.add("cmake");
  if (lower.some((file) => file.endsWith("makefile"))) buildSystems.add("make");
  if (lower.some((file) => file.endsWith("package.json"))) buildSystems.add("npm");
  if (lower.some((file) => file.endsWith("cargo.toml"))) buildSystems.add("cargo");

  return Object.freeze({
    languages: [...languages].sort(),
    frameworks: [...frameworks].sort(),
    build_systems: [...buildSystems].sort(),
    has_github_actions: lower.some((file) => file.startsWith(".github/workflows/")),
    has_cpp: [...languages].includes("cpp"),
    has_aegisc: lower.some((file) => file.endsWith(".aegis") || file.includes("aegisc")),
    has_pasor: lower.some((file) => file.includes("pasor")),
  });
}

/**
 * Build a deterministic, immutable project inventory used as PASOR input.
 * The provenance hash binds the tenant/project/revision/file-set snapshot and
 * the derived capability inventory consumed by the planner.
 */
export function buildProjectInventory(input: ProjectInventoryInput): ProjectInventory {
  if (!input.tenant_id || !input.project_id || !input.owner || !input.repository || !input.revision) {
    throw new Error("project_inventory_identity_required");
  }
  if (!Array.isArray(input.files)) {
    throw new Error("project_inventory_files_required");
  }

  const files = [...new Set(input.files.map((file) => file.trim()).filter(Boolean))].sort();
  const detected = detect(files);
  const canonical = JSON.stringify({
    schema: "hoare.project-inventory/v1",
    tenant_id: input.tenant_id,
    project_id: input.project_id,
    owner: input.owner,
    repository: input.repository,
    revision: input.revision,
    files,
    detected,
  });
  const inventoryHash = createHash("sha256").update(canonical).digest("hex");

  return Object.freeze({
    ...input,
    schema: "hoare.project-inventory/v1",
    files: Object.freeze(files),
    detected,
    inventory_hash: inventoryHash,
    provenance_hash: inventoryHash,
  });
}
