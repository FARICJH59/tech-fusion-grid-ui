import assert from "node:assert/strict";
import test from "node:test";
import { compileAegis } from "../lib/aegisc";
import { verifyAegisc } from "../lib/aegisc/verifier";
import { ActionAuthorizationEngine, ActionExecutionPlane, ShortLivedIdentityBroker } from "../lib/hoare-actions";

test("AEGISC IR uses a verifiable SHA-256 integrity hash", () => {
  const ir = compileAegis({ name: "test", version: 1, rules: [{ action: "deploy", effect: "ALLOW" }] });
  const result = verifyAegisc(ir);
  assert.equal(result.valid, true);
  assert.equal(result.hashValid, true);
  assert.equal(result.immutable, true);
});

test("short-lived identities are cryptographically random and bounded", () => {
  const broker = new ShortLivedIdentityBroker();
  const request = { action: "deploy.staging", actor: "actor", tenantId: "tenant", environment: "staging" as const };
  const first = broker.issue(request, 60);
  const second = broker.issue(request, 60);
  assert.notEqual(first.token, second.token);
  assert.equal(first.tenantId, "tenant");
  assert.throws(() => broker.issue(request, 0));
  assert.throws(() => broker.issue(request, 3601));
});

test("action execution is replay-safe by request ID", async () => {
  let executions = 0;
  const plane = new ActionExecutionPlane(new ActionAuthorizationEngine([{ action: "deploy.staging", effect: "ALLOW", roles: ["operator"], environments: ["staging"] }]));
  const request = { action: "deploy.staging", actor: "actor", tenantId: "tenant", environment: "staging" as const, requestId: "req-1" };
  const handler = async () => { executions += 1; return { ok: true }; };
  await plane.execute(request, { id: "step-1", action: request.action }, handler, "operator");
  await plane.execute(request, { id: "step-1", action: request.action }, handler, "operator");
  assert.equal(executions, 1);
});
