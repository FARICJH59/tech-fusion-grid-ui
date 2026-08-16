import crypto from "node:crypto";

export type BrainProposalUnit = {
  command_id: string;
  parameters?: Record<string, unknown>;
  dependencies?: string[];
  energy_cost?: number;
  quota_cost?: number;
  optional?: boolean;
};

export type ExecutionUnit = {
  unit_id: string;
  command_id: string;
  parameters: Record<string, unknown>;
  dependencies: string[];
  energy_cost: number;
  quota_cost: number;
  optional: boolean;
  simulation_hash: string;
  provenance_hash: string;
};

export type BrainProposal = {
  project_id: string;
  tenant_id: string;
  units: BrainProposalUnit[];
  intent_summary?: string;
};

export type PasorPlan = {
  project_id: string;
  tenant_id: string;
  execution_units: ExecutionUnit[];
};

function stableJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  const object = value as Record<string, unknown>;
  return `{${Object.keys(object).sort().map((key) => `${JSON.stringify(key)}:${stableJson(object[key])}`).join(",")}}`;
}

function hash(value: unknown): string {
  return crypto.createHash("sha256").update(stableJson(value)).digest("hex");
}

/**
 * Converts an intelligence proposal into the canonical PASOR contract.
 * Internal reasoning, prompts, memory, chain-of-thought, credentials and
 * provider-specific brain state are intentionally not accepted by this API.
 */
export function brainProposalToPasor(proposal: BrainProposal): PasorPlan {
  if (!proposal.project_id || !proposal.tenant_id || !Array.isArray(proposal.units)) {
    throw new Error("INVALID_BRAIN_PROPOSAL");
  }

  const execution_units = proposal.units.map((unit, index) => {
    if (!unit.command_id) throw new Error("COMMAND_ID_REQUIRED");

    const canonical = {
      project_id: proposal.project_id,
      tenant_id: proposal.tenant_id,
      index,
      command_id: unit.command_id,
      parameters: unit.parameters ?? {},
      dependencies: unit.dependencies ?? [],
      energy_cost: Math.max(0, unit.energy_cost ?? 0),
      quota_cost: Math.max(0, unit.quota_cost ?? 0),
      optional: unit.optional === true,
    };

    return {
      unit_id: `unit_${index + 1}`,
      command_id: canonical.command_id,
      parameters: canonical.parameters,
      dependencies: canonical.dependencies,
      energy_cost: canonical.energy_cost,
      quota_cost: canonical.quota_cost,
      optional: canonical.optional,
      simulation_hash: hash({ type: "simulation", ...canonical }),
      provenance_hash: hash({ type: "provenance", ...canonical }),
    };
  });

  return {
    project_id: proposal.project_id,
    tenant_id: proposal.tenant_id,
    execution_units,
  };
}
