import test from "node:test";
import assert from "node:assert/strict";

import { supabaseProductionRuntime } from "../lib/supabase-production";

test("RLS isolation denies cross-tenant and cross-org access", () => {
  assert.equal(
    supabaseProductionRuntime.verifyRlsIsolation({
      requesterTenantId: "tenant-a",
      requesterOrganizationId: "org-a",
      rowTenantId: "tenant-a",
      rowOrganizationId: "org-a",
      role: "operator",
    }),
    true,
  );

  assert.equal(
    supabaseProductionRuntime.verifyRlsIsolation({
      requesterTenantId: "tenant-a",
      requesterOrganizationId: "org-a",
      rowTenantId: "tenant-b",
      rowOrganizationId: "org-b",
      role: "operator",
    }),
    false,
  );
});
