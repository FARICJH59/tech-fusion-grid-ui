import assert from "node:assert/strict";
import test from "node:test";
import { resolveEntitlements } from "@/lib/enterprise/entitlements";
import { reconcileBilling } from "./billing-reconciliation";

test("active subscription remains executable and preserves tenant billing identity", () => {
  const result = reconcileBilling({
    tenantId: "tenant-1",
    customerId: "customer-1",
    subscriptionId: "subscription-1",
    tier: "enterprise",
    status: "active",
    creditsRemaining: 100,
    entitlements: resolveEntitlements("enterprise", 100, "admin"),
  });

  assert.equal(result.active, true);
  assert.equal(result.reason, "ACTIVE");
  assert.equal(result.tenantId, "tenant-1");
  assert.equal(result.customerId, "customer-1");
  assert.equal(result.subscriptionId, "subscription-1");
  assert.equal(result.creditsRemaining, 100);
});

test("past-due subscription is denied without destroying its tenant identity", () => {
  const result = reconcileBilling({
    tenantId: "tenant-2",
    customerId: "customer-2",
    subscriptionId: "subscription-2",
    tier: "pro",
    status: "past_due",
    creditsRemaining: 20,
    entitlements: resolveEntitlements("pro", 20, "operator"),
  });

  assert.equal(result.active, false);
  assert.equal(result.reason, "PAST_DUE");
  assert.equal(result.tenantId, "tenant-2");
  assert.equal(result.customerId, "customer-2");
});

test("negative credits are normalized to zero", () => {
  const result = reconcileBilling({
    tenantId: "tenant-3",
    customerId: "customer-3",
    subscriptionId: "subscription-3",
    tier: "free",
    status: "active",
    creditsRemaining: -5,
    entitlements: resolveEntitlements("free", -5, "viewer"),
  });

  assert.equal(result.creditsRemaining, 0);
});
