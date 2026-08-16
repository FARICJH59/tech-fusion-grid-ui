import assert from "node:assert/strict";
import test from "node:test";
import { createTenantId, isTenantId } from "./tenant-id";

test("tenant IDs use the opaque public format", () => {
  const id = createTenantId();
  assert.match(id, /^ten_[a-f0-9]{32}$/);
  assert.equal(isTenantId(id), true);
  assert.equal(isTenantId("550e8400-e29b-41d4-a716-446655440000"), false);
  assert.equal(isTenantId("tenant_123"), false);
});
