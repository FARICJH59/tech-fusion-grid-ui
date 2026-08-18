import assert from "node:assert/strict";
import test from "node:test";
import { CustomActionControlPlane } from "../agentfusion/control-plane/custom-actions";

test("custom action control plane enforces allow, deny and escalation", () => {
  const cp = new CustomActionControlPlane();
  cp.setPolicy("tenant-a", { allowedActions: ["deploy", "rollback"], deniedActions: ["destroy"], productionApproval: true, maxCostUsd: 100 });

  assert.equal(cp.authorize({ tenantId: "tenant-a", actorId: "a", action: "deploy", resource: "svc", environment: "staging" }).decision, "ALLOW");
  assert.equal(cp.authorize({ tenantId: "tenant-a", actorId: "a", action: "destroy", resource: "svc", environment: "staging" }).decision, "DENY");
  assert.equal(cp.authorize({ tenantId: "tenant-a", actorId: "a", action: "deploy", resource: "svc", environment: "production" }).decision, "ESCALATE");
  assert.equal(cp.authorize({ tenantId: "tenant-a", actorId: "a", action: "deploy", resource: "svc", environment: "staging", estimatedCostUsd: 101 }).decision, "DENY");
});

test("runbooks are versioned and checksummed", () => {
  const cp = new CustomActionControlPlane();
  const runbook = cp.registerRunbook("tenant-a", "deploy-service", 1, [{ id: "build", action: "build" }, { id: "deploy", action: "deploy", requiresApproval: true }]);
  assert.equal(runbook.version, 1);
  assert.equal(runbook.checksum.length, 64);
  assert.equal(cp.getRunbook("tenant-a", "deploy-service")?.checksum, runbook.checksum);
});

test("short-lived identity expires and execution is replay-safe", async () => {
  const cp = new CustomActionControlPlane();
  const identity = cp.issueIdentity("agent-1", "hoare", 60);
  assert.equal(cp.isIdentityValid(identity.token, identity.issuedAt + 1), true);
  assert.equal(cp.isIdentityValid(identity.token, identity.expiresAt), false);

  cp.setPolicy("tenant-a", { allowedActions: ["deploy"] });
  let calls = 0;
  const request = { tenantId: "tenant-a", actorId: "agent-1", action: "deploy", resource: "svc", environment: "staging" as const, requestId: "req-1" };
  const first = await cp.execute(request, async () => { calls += 1; return { ok: true }; });
  const second = await cp.execute(request, async () => { calls += 1; return { ok: true }; });
  assert.equal(first.decision, "ALLOW");
  assert.equal(second.decision, "ALLOW");
  assert.equal(calls, 1);
});
