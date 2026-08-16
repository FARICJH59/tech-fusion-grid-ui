import type { Entitlements, SubscriptionTier } from "@/lib/enterprise/entitlements";
import type { ExecutionEntitlement } from "../governance/execution-gate";

export type BillingSnapshot = {
  tenantId: string;
  tier: SubscriptionTier;
  status: "active" | "inactive";
  creditsRemaining: number;
  entitlements: Entitlements;
};

/** Translate application billing state into the provider-neutral runtime contract. */
export function toExecutionEntitlement(snapshot: BillingSnapshot): ExecutionEntitlement {
  const capabilities: string[] = [];
  if (snapshot.entitlements.features.aiOrchestration) capabilities.push("ai.orchestration");
  if (snapshot.entitlements.features.cloudDeployments) capabilities.push("cloud.deploy");
  if (snapshot.entitlements.features.advancedPolicy) capabilities.push("policy.advanced");
  if (snapshot.entitlements.features.fleetOps) capabilities.push("fleet.ops");
  if (snapshot.entitlements.features.auditExports) capabilities.push("audit.export");
  if (snapshot.entitlements.features.billingPortal) capabilities.push("billing.manage");

  return {
    tenantId: snapshot.tenantId,
    active: snapshot.status === "active",
    capabilities,
    quotaRemaining: Math.max(0, snapshot.creditsRemaining),
  };
}
