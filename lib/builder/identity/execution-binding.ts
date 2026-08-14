import { createHash } from "node:crypto";
import { assertTenantId } from "../../identity/tenant-id";
import type { GitHubRepositoryImport } from "../../github/import-types";

export type ExecutionBindingContext = {
  tenantId: string;
  projectId: string;
  principalId: string;
  githubRepository?: Pick<GitHubRepositoryImport, "tenantId" | "owner" | "repo" | "ref" | "repositoryId" | "provenanceHash">;
  repositoryAccessVerified?: boolean;
};

export type BoundExecutionUnit = {
  unit_id: string;
  command_id: string;
  parameters?: Record<string, unknown>;
  dependencies?: string[];
  energy_cost: number;
  quota_cost: number;
  optional?: boolean;
  simulation_hash: string;
  provenance_hash: string;
  execution_binding_hash: string;
};

function stableJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  const object = value as Record<string, unknown>;
  return `{${Object.keys(object).sort().map((key) => `${JSON.stringify(key)}:${stableJson(object[key])}`).join(",")}}`;
}

function sha256(value: unknown): string {
  return createHash("sha256").update(stableJson(value)).digest("hex");
}

/**
 * Creates a non-secret execution binding. The binding contains no brain
 * memory, prompts, credentials, or internal reasoning. It binds the unit to
 * the public tenant, project, principal and (when present) verified GitHub
 * repository provenance.
 */
export function bindExecutionUnit(
  unit: Omit<BoundExecutionUnit, "execution_binding_hash">,
  context: ExecutionBindingContext,
): BoundExecutionUnit {
  assertTenantId(context.tenantId);
  if (!context.projectId || !context.principalId) throw new Error("EXECUTION_IDENTITY_REQUIRED");

  if (context.githubRepository) {
    if (context.githubRepository.tenantId !== context.tenantId) {
      throw new Error("TENANT_REPOSITORY_MISMATCH");
    }
    if (!context.repositoryAccessVerified) {
      throw new Error("REPOSITORY_ACCESS_NOT_VERIFIED");
    }
  }

  const binding = {
    tenantId: context.tenantId,
    projectId: context.projectId,
    principalId: context.principalId,
    repository: context.githubRepository
      ? {
          tenantId: context.githubRepository.tenantId,
          owner: context.githubRepository.owner,
          repo: context.githubRepository.repo,
          ref: context.githubRepository.ref,
          repositoryId: context.githubRepository.repositoryId,
          provenanceHash: context.githubRepository.provenanceHash,
        }
      : undefined,
    unit: {
      unit_id: unit.unit_id,
      command_id: unit.command_id,
      simulation_hash: unit.simulation_hash,
      provenance_hash: unit.provenance_hash,
    },
  };

  return { ...unit, execution_binding_hash: sha256(binding) };
}

export function verifyExecutionBinding(
  unit: BoundExecutionUnit,
  context: ExecutionBindingContext,
): boolean {
  try {
    return bindExecutionUnit(unit, context).execution_binding_hash === unit.execution_binding_hash;
  } catch {
    return false;
  }
}
