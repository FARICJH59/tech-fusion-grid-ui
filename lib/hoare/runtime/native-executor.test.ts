import { test } from "node:test";
import assert from "node:assert/strict";
import { NativeRuntimeExecutor } from "./native-executor";

test("native executor starts and stops a service", async () => {
  const executor = new NativeRuntimeExecutor();
  const service = executor.start({
    id: "test-service",
    command: process.execPath,
    args: ["-e", "setTimeout(() => {}, 5000)"],
  });

  assert.equal(service.id, "test-service");
  assert.ok(service.pid);

  await new Promise((resolve) => setTimeout(resolve, 50));
  assert.equal(executor.status()[0]?.state, "running");

  executor.stop("test-service");
  assert.equal(executor.status()[0]?.state, "stopped");
});
