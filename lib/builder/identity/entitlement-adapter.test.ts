import assert from "node:assert/strict";
import test from "node:test";
import { resolveEntitlements } from "@/lib/enterprise/entitlements";
import { toExecutionEntitlement } from "./entitlement-adapter";

test("maps active enterprise billing to runtime capabilities and quota", () => {
  const entitlements = resolveEntitlements("enterprise", 42, "admin");
  const runtime = toExecutionEntitlement({ tenantId: "tenant-1", tier: "enterprise", status: "active", creditsRemaining: 42, entitlements });

  assert.equal(runtime.active, true);
  assert.equal(runtime.tenantId, "tenant-1");
  assert.equal(runtime.quotaRemaining, 42);
  assert.ok(runtime.capabilities.includes("ai.orchestration"));
  assert.ok(runtime.capabilities.includes("cloud.deploy"));
});

test("inactive billing state disables runtime admission", () => {
  const entitlements = resolveEntitlements("pro", 20, "operator");
  const runtime = toExecutionEntitlement({ tenantId: "tenant-2", tier: "pro", status: "inactive", creditsRemaining: 20, entitlements });
  assert.equal(runtime.active, false);
});
