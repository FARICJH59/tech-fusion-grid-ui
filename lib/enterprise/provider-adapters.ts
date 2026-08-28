import type { HoareIamPlan } from "./hoare-builder-planner";

export type ProviderAdapterKind = "aws" | "gcp" | "azure";

export interface ProviderPermission {
  action: string;
  scope: "tenant" | "resource" | "provider";
}

export interface ProviderAdapterPlan {
  provider: ProviderAdapterKind;
  identityMechanism: "temporary";
  permissions: ProviderPermission[];
  explicitDenials: string[];
  requiresProviderAuthorization: true;
}

/**
 * Translate HOARE's provider-neutral IAM intent into provider-neutral adapter
 * instructions. This intentionally does not call a cloud API or emit vendor
 * credentials. A later provider implementation owns those details.
 */
export function compileProviderAdapterPlan(iam: HoareIamPlan): ProviderAdapterPlan {
  return {
    provider: iam.provider,
    identityMechanism: "temporary",
    permissions: iam.permissions.map((action) => ({
      action,
      scope: action.includes("storage") ? "resource" : "tenant",
    })),
    explicitDenials: [...iam.forbidden],
    requiresProviderAuthorization: true,
  };
}

export function isSafeProviderAdapterPlan(plan: ProviderAdapterPlan): boolean {
  return (
    plan.identityMechanism === "temporary" &&
    plan.requiresProviderAuthorization === true &&
    plan.explicitDenials.includes("iam.*") &&
    plan.explicitDenials.includes("long-lived-credentials") &&
    !plan.permissions.some((permission) => permission.action === "iam.*")
  );
}
