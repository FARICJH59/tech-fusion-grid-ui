import test from "node:test";
import assert from "node:assert/strict";

import { ToolRegistry } from "../../packages/agent-sdk/src";

test("tool framework executes through the standardized abstraction", async () => {
  const registry = new ToolRegistry();

  registry.register({
    id: "tenant-api-tool",
    name: "Tenant API Tool",
    description: "Calls a tenant-safe API.",
    category: "api",
    inputSchema: { type: "object", required: ["message"] },
    outputSchema: { type: "object", required: ["echo"] },
    permissions: [],
    validateInput(input) {
      return typeof input === "object" && input !== null && "message" in input;
    },
    validateOutput(output) {
      return typeof output === "object" && output !== null && "echo" in output;
    },
    async execute(input: { message: string }) {
      return { echo: input.message };
    },
  });

  const result = await registry.execute<{ message: string }, { echo: string }>("tenant-api-tool", { message: "hello" }, {
    requestId: "req-1",
    tenant: { tenantId: "tenant-1" },
    actor: { id: "user-1", role: "viewer", type: "user" },
  });

  assert.equal(result.toolId, "tenant-api-tool");
  assert.deepEqual(result.output, { echo: "hello" });
  assert.equal(registry.list("api").length, 1);
});
