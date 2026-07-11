import test from "node:test";
import assert from "node:assert/strict";

import { CapabilityRegistry } from "../../packages/agent-sdk/src";

test("capability registry supports discovery, validation, and versioning", () => {
  const registry = new CapabilityRegistry();

  registry.register({
    id: "runtime-execution",
    name: "Runtime Execution",
    description: "Executes enterprise runtime actions.",
    type: "execution",
    version: "1.0.0",
    actions: ["deploy"],
    tools: ["dispatcher"],
  });
  registry.register({
    id: "runtime-execution",
    name: "Runtime Execution",
    description: "Executes enterprise runtime actions.",
    type: "execution",
    version: "1.1.0",
    actions: ["deploy", "scale"],
    tools: ["dispatcher"],
  });

  assert.equal(registry.discover({ action: "scale" }).length, 1);
  assert.equal(registry.listVersions("runtime-execution").length, 2);
  assert.equal(registry.latest("runtime-execution")?.version, "1.1.0");
  assert.deepEqual(registry.validate(["runtime-execution", "missing-capability"]).missing, ["missing-capability"]);
});
