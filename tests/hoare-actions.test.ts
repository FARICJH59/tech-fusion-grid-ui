import assert from "node:assert/strict";
import test from "node:test";
import { ActionAuthorizationEngine, ActionExecutionPlane, EnvironmentGovernance, RunbookRegistry } from "../lib/hoare-actions";

test("runbook registry stores versioned tenant workflows", () => {
  const registry = new RunbookRegistry();
  registry.register({ tenantId: "t1", name: "deploy", version: 1, steps: [{ id: "build", action: "build" }] });
  assert.equal(registry.get("t1", "deploy", 1)?.steps[0].action, "build");
});

test("production governance blocks non-approved actions", () => {
  const auth = new ActionAuthorizationEngine([{ action: "read", effect: "ALLOW" }]);
  const decision = auth.decide({ action: "read", actor: "a", tenantId: "t1", environment: "production" });
  assert.equal(decision.effect, "ESCALATE");
});

test("authorized action receives short-lived identity and executes", async () => {
  const auth = new ActionAuthorizationEngine([{ action: "deploy.production", effect: "ALLOW", roles: ["operator"] }]);
  const plane = new ActionExecutionPlane(auth);
  let executed = false;
  const result = await plane.execute(
    { action: "deploy.production", actor: "u1", tenantId: "t1", environment: "production" },
    { id: "deploy", action: "deploy.production" },
    async () => { executed = true; return "ok"; },
    "operator",
  );
  assert.equal(result.decision.effect, "ALLOW");
  assert.equal(executed, true);
  assert.equal(result.identity?.tenantId, "t1");
});

test("denied action never reaches handler", async () => {
  const auth = new ActionAuthorizationEngine([{ action: "deploy.production", effect: "DENY" }]);
  const plane = new ActionExecutionPlane(auth);
  let executed = false;
  const result = await plane.execute(
    { action: "deploy.production", actor: "u1", tenantId: "t1", environment: "production" },
    { id: "deploy", action: "deploy.production" },
    async () => { executed = true; return "bad"; },
  );
  assert.equal(result.decision.effect, "DENY");
  assert.equal(executed, false);
});
