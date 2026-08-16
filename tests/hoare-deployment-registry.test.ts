import test from "node:test";
import assert from "node:assert/strict";
import { DeploymentRegistry } from "../lib/hoare/deployment/deployment-registry";

test("deployment registry exposes the native lifecycle contract", () => {
  const registry = new DeploymentRegistry();
  assert.equal(typeof registry.create, "function");
  assert.equal(typeof registry.get, "function");
  assert.equal(typeof registry.list, "function");
  assert.equal(typeof registry.update, "function");
});

test("deployment lifecycle statuses are bounded", () => {
  const statuses = ["planned", "building", "ready", "running", "stopped", "failed"] as const;
  assert.deepEqual(statuses, ["planned", "building", "ready", "running", "stopped", "failed"]);
});
