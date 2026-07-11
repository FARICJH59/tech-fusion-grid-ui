import type { Role } from "@/lib/auth";

export type SubscriptionTier = "free" | "pro" | "enterprise";

export type Entitlements = {
  tier: SubscriptionTier;
  creditsRemaining: number;
  features: {
    cloudDeployments: boolean;
    advancedPolicy: boolean;
    aiOrchestration: boolean;
    auditExports: boolean;
    fleetOps: boolean;
    billingPortal: boolean;
  };
  limits: {
    maxAgents: number;
    maxWorkspaces: number;
    maxEventsPerMinute: number;
  };
};

const TIER_LIMITS: Record<SubscriptionTier, Entitlements["limits"]> = {
  free: {
    maxAgents: 3,
    maxWorkspaces: 1,
    maxEventsPerMinute: 2_000,
  },
  pro: {
    maxAgents: 30,
    maxWorkspaces: 10,
    maxEventsPerMinute: 20_000,
  },
  enterprise: {
    maxAgents: 500,
    maxWorkspaces: 100,
    maxEventsPerMinute: 250_000,
  },
};

export function resolveEntitlements(
  tier: SubscriptionTier,
  creditsRemaining: number,
  role: Role,
): Entitlements {
  const hasCredits = creditsRemaining > 0;

  const features = {
    cloudDeployments: tier !== "free" && hasCredits,
    advancedPolicy: tier === "enterprise",
    aiOrchestration: tier !== "free",
    auditExports: tier !== "free",
    fleetOps: tier !== "free",
    billingPortal: role === "admin" || role === "operator",
  };

  return {
    tier,
    creditsRemaining,
    features,
    limits: TIER_LIMITS[tier],
  };
}
