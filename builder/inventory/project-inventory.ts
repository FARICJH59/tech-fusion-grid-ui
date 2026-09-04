import { createHash } from "node:crypto";

export type ProjectInventoryInput = Readonly<{
  tenant_id: string;
  project_id: string;
  owner: string;
  repository: string;
  revision: string;
  files: readonly string[];
}>;

export type ProjectInventory = Readonly<ProjectInventoryInput & {
  inventory_hash: string;
}>;

/**
 * Build a deterministic, immutable project inventory used as PASOR input.
 * The inventory hash binds the tenant/project/revision/file-set snapshot.
 */
export function buildProjectInventory(input: ProjectInventoryInput): ProjectInventory {
  if (!input.tenant_id || !input.project_id || !input.owner || !input.repository || !input.revision) {
    throw new Error("project_inventory_identity_required");
  }
  if (!Array.isArray(input.files)) {
    throw new Error("project_inventory_files_required");
  }

  const files = [...new Set(input.files.map((file) => file.trim()).filter(Boolean))].sort();
  const canonical = JSON.stringify({
    tenant_id: input.tenant_id,
    project_id: input.project_id,
    owner: input.owner,
    repository: input.repository,
    revision: input.revision,
    files,
  });

  return Object.freeze({
    tenant_id: input.tenant_id,
    project_id: input.project_id,
    owner: input.owner,
    repository: input.repository,
    revision: input.revision,
    files: Object.freeze(files),
    inventory_hash: createHash("sha256").update(canonical).digest("hex"),
  });
}
