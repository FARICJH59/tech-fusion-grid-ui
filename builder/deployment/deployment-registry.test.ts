import assert from "node:assert/strict";
import test from "node:test";
import type { DeploymentAdapter } from "./deployment-adapter";
import { DeploymentAdapterRegistry } from "./deployment-registry";

function adapter(target: DeploymentAdapter["target"]): DeploymentAdapter {
  return {
    target,
    async deploy(request) {
      return {
        unitId: request.unitId,
        target,
        accepted: true,
        message: "test adapter",
      };
    },
  };
}

test("registry resolves the selected provider adapter", () => {
  const registry = new DeploymentAdapterRegistry();
  const cloudRun = adapter("cloud-run");

  registry.register(cloudRun);

  assert.equal(registry.get("cloud-run"), cloudRun);
  assert.equal(registry.has("cloud-run"), true);
  assert.deepEqual(registry.targets(), ["cloud-run"]);
});

test("registry rejects duplicate provider adapters", () => {
  const registry = new DeploymentAdapterRegistry();
  registry.register(adapter("cloud-run"));

  assert.throws(
    () => registry.register(adapter("cloud-run")),
    /DEPLOYMENT_ADAPTER_ALREADY_REGISTERED:cloud-run/,
  );
});

test("registry fails closed for an unregistered provider", () => {
  const registry = new DeploymentAdapterRegistry();

  assert.throws(
    () => registry.get("edge"),
    /DEPLOYMENT_ADAPTER_NOT_REGISTERED:edge/,
  );
});
