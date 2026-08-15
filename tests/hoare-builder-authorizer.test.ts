import test from "node:test";
import assert from "node:assert/strict";
import { buildResource } from "../lib/hoare/builder";
import { authorizeBuild } from "../lib/hoare/builder-authorizer";

test("builder authorization preserves tenant isolation", () => {
  const request = { tenantId: "tenant-a", name: "inventory-agent", kind: "agent" as const };
  const artifact = buildResource(request);
  assert.equal(authorizeBuild(request, artifact).decision, "ALLOW");

  const crossTenant = { ...request, tenantId: "tenant-b" };
  const result = authorizeBuild(crossTenant, artifact);
  assert.equal(result.decision, "DENY");
  assert.equal(result.reason, "TENANT_ISOLATION_FAILED");
});

test("autonomous IoT remains blocked until runtime policy exists", () => {
  const request = { tenantId: "tenant-a", name: "pump", kind: "iot" as const, mode: "autonomous" as const };
  const artifact = buildResource(request);
  const result = authorizeBuild(request, artifact);
  assert.equal(result.decision, "DENY");
  assert.equal(result.reason, "AUTONOMOUS_IOT_REQUIRES_RUNTIME_POLICY");
});
