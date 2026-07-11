import test from "node:test";
import assert from "node:assert/strict";
import { deterministicTenantSlug } from "../lib/enterprise/provisioning";

test("deterministicTenantSlug normalizes names and includes stable suffix", () => {
  const slug = deterministicTenantSlug(
    "Alice+Ops@Example.COM",
    "12345678-abcd-efgh-ijkl-1234567890ab",
    "Acme Grid Labs",
  );

  assert.equal(slug, "acme-grid-labs-alice-ops-12345678");
});

test("deterministicTenantSlug differs across user IDs to avoid collisions", () => {
  const a = deterministicTenantSlug("ops@example.com", "aaaaaaaa-0000-0000-0000-000000000000", "Acme");
  const b = deterministicTenantSlug("ops@example.com", "bbbbbbbb-0000-0000-0000-000000000000", "Acme");

  assert.notEqual(a, b);
});

test("deterministicTenantSlug enforces max slug length", () => {
  const slug = deterministicTenantSlug(
    "very-long-email-address-for-collision-test@example.com",
    "cccccccc-0000-0000-0000-000000000000",
    "This Organization Name Is Excessively Long And Should Be Truncated Safely",
  );

  assert.ok(slug.length <= 63);
});
