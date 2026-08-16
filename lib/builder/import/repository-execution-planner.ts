import { brainProposalToPasor, type BrainProposal, type PasorPlan } from "../pasor/brain-adapter";

export type RepositoryInventory = {
  repository: string;
  ref: string;
  languages: string[];
  frameworks: string[];
  buildSystems: string[];
  hasTests: boolean;
};

export type RepositoryBuildPlan = PasorPlan & {
  inventory: RepositoryInventory;
};

/**
 * Turns repository inspection into a bounded build/test plan. Inspection is
 * deliberately read-only; execution is represented as PASOR units and must
 * pass the downstream governance gate before a runner is invoked.
 */
export function createRepositoryBuildPlan(
  inventory: RepositoryInventory,
  identity: { projectId: string; tenantId: string },
): RepositoryBuildPlan {
  const units: BrainProposal["units"] = [
    {
      command_id: "repo.validate_inventory",
      parameters: { repository: inventory.repository, ref: inventory.ref },
      energy_cost: 1,
      quota_cost: 0,
    },
    {
      command_id: "repo.build",
      parameters: {
        languages: inventory.languages,
        frameworks: inventory.frameworks,
        buildSystems: inventory.buildSystems,
      },
      dependencies: ["unit_1"],
      energy_cost: 5,
      quota_cost: 2,
    },
  ];

  if (inventory.hasTests) {
    units.push({
      command_id: "repo.test",
      dependencies: ["unit_2"],
      energy_cost: 3,
      quota_cost: 1,
    });
  }

  const plan = brainProposalToPasor({
    project_id: identity.projectId,
    tenant_id: identity.tenantId,
    units,
  });

  return { ...plan, inventory };
}
