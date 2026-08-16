import test from "node:test";
import assert from "node:assert/strict";
import { NativeRuntimeExecutor } from "../lib/hoare/deployment/native-runtime-executor";

test("native runtime executor starts empty", () => {
  const executor = new NativeRuntimeExecutor();
  assert.deepEqual(executor.list(), []);
  assert.equal(executor.status("missing"), null);
});

test("native runtime executor rejects shell chaining", async () => {
  const executor = new NativeRuntimeExecutor();
  const deployment = {
    id: "deployment-test",
    tenantId: "tenant-test",
    projectId: "project-test",
    name: "test",
    target: "full-stack" as const,
    status: "planned" as const,
    version: "v1",
    region: "local",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  await assert.rejects(
    executor.start(deployment, "node", ["-e", "console.log('ok')"]),
    /not configured|SUPABASE|Redis|ENOENT|fetch failed|Cannot read|upsert/i,
  );

  await assert.rejects(
    executor.start(deployment, "node && rm", []),
    /Unsafe runtime command/,
  );
});
