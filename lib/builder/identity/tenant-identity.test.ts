import assert from "node:assert/strict";
import test from "node:test";
import { resolveCanonicalIdentity } from "./tenant-identity";

test("preserves the canonical tenant when GitHub is linked to an email account", () => {
  const first = resolveCanonicalIdentity({ accountId: "acct-1", provider: "email", subjectId: "email-sub" });
  const linked = resolveCanonicalIdentity(
    { accountId: "provider-account-should-not-win", provider: "github", subjectId: "github-sub" },
    first,
  );

  assert.equal(linked.accountId, "acct-1");
  assert.equal(linked.tenantId, "acct-1");
  assert.equal(linked.subjectId, "github-sub");
  assert.equal(linked.provider, "github");
});
