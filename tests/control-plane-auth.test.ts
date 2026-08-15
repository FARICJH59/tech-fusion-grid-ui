import test from "node:test";
import assert from "node:assert/strict";
import { EnterpriseSecurity } from "@/lib/enterprise/security";

test("enterprise security enforces RBAC and tenant isolation", () => {
  const security = new EnterpriseSecurity();

  assert.equal(
    security.isAuthorized({
      role: "admin",
      tenantId: "tenant-a",
      resourceTenantId: "tenant-a",
      requiredRole: "operator",
      attributes: { scope: "write" },
    }),
    true,
  );

  assert.equal(
    security.isAuthorized({
      role: "viewer",
      tenantId: "tenant-a",
      resourceTenantId: "tenant-a",
      requiredRole: "operator",
      attributes: { scope: "write" },
    }),
    false,
  );

  assert.equal(
    security.isAuthorized({
      role: "admin",
      tenantId: "tenant-a",
      resourceTenantId: "tenant-b",
      requiredRole: "viewer",
    }),
    false,
  );
});
