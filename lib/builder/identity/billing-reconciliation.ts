import type { SubscriptionTier, Entitlements } from "@/lib/enterprise/entitlements";

export type SubscriptionState = "active" | "trialing" | "past_due" | "canceled" | "inactive";

export type CanonicalBillingRecord = {
  tenantId: string;
  customerId: string;
  subscriptionId: string;
  tier: SubscriptionTier;
  status: SubscriptionState;
  creditsRemaining: number;
  entitlements: Entitlements;
};

export type BillingReconciliationResult = {
  tenantId: string;
  active: boolean;
  customerId: string;
  subscriptionId: string;
  tier: SubscriptionTier;
  creditsRemaining: number;
  entitlements: Entitlements;
  reason: "ACTIVE" | "INACTIVE" | "PAST_DUE" | "CANCELED";
};

/**
 * Converts an already-authoritative billing snapshot into the runtime's
 * canonical tenant billing state. Provider-specific webhook handling stays
 * outside the builder runtime.
 */
export function reconcileBilling(record: CanonicalBillingRecord): BillingReconciliationResult {
  const active = record.status === "active" || record.status === "trialing";
  const reason = record.status === "past_due"
    ? "PAST_DUE"
    : record.status === "canceled"
      ? "CANCELED"
      : active
        ? "ACTIVE"
        : "INACTIVE";

  return {
    tenantId: record.tenantId,
    active,
    customerId: record.customerId,
    subscriptionId: record.subscriptionId,
    tier: record.tier,
    creditsRemaining: Math.max(0, record.creditsRemaining),
    entitlements: record.entitlements,
    reason,
  };
}
