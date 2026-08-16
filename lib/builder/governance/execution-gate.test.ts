import assert from "node:assert/strict";
import test from "node:test";
import { authorizeExecution } from "./execution-gate";

const base = {
  principal: { id: "user-1", roles: ["operator"] },
  entitlement: { tenantId: "tenant-1", active: true, capabilities: ["build.project"], quotaRemaining: 10 },
  action: "build.project",
  quotaCost: 4,
};

test("allows entitled operator execution", () => assert.deepEqual(authorizeExecution(base), { allowed: true, reason: "ALLOW" }));
test("denies insufficient role", () => assert.equal(authorizeExecution({ ...base, principal: { id: "u", roles: ["viewer"] } }).reason, "IAM_DENIED"));
test("denies missing capability", () => assert.equal(authorizeExecution({ ...base, entitlement: { ...base.entitlement, capabilities: [] } }).reason, "CAPABILITY_DENIED"));
test("denies insufficient quota", () => assert.equal(authorizeExecution({ ...base, entitlement: { ...base.entitlement, quotaRemaining: 1 } }).reason, "QUOTA_DENIED"));
test("denies inactive tenant", () => assert.equal(authorizeExecution({ ...base, entitlement: { ...base.entitlement, active: false } }).reason, "TENANT_INACTIVE"));
