import assert from "node:assert/strict";
import test from "node:test";
import { createSafeRemediationRegistry } from "./remediation-handlers";

test("registers the governed remediation vocabulary", async () => {
  const registry = createSafeRemediationRegistry();

  for (const command of [
    "runtime.restart",
    "runtime.scale",
    "runtime.rollback",
    "runtime.isolate",
  ]) {
    assert.equal(registry.has(command), true);
  }
});

test("returns an execution handoff rather than bypassing governance", async () => {
  const registry = createSafeRemediationRegistry();
  const result = await registry.execute("runtime.restart", {
    tenantId: "tenant-1",
    target: "hoare",
    incidentId: "incident-1",
    parameters: { service: "hoare-api" },
  });

  assert.equal(result.accepted, true);
  assert.equal(result.actionId, "incident-1:runtime.restart");
  assert.match(result.message, /governed execution/);
});

test("rejects commands outside the allowlist", async () => {
  const registry = createSafeRemediationRegistry();

  await assert.rejects(
    () => registry.execute("runtime.restart" as never, {
      tenantId: "tenant-1",
      target: "hoare",
      incidentId: "incident-1",
      parameters: {},
    }),
    /REMEDIATION_HANDLER_NOT_REGISTERED/,
  );
});
