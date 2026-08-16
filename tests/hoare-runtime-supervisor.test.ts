import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const deploymentId = "dep_supervisor_test_01";

test("runtime supervisor supports start, restart, and stop", async () => {
  const dir = await mkdtemp(join(tmpdir(), "hoare-supervisor-"));
  const previous = process.env.HOARE_RUNTIME_DATA_DIR;
  process.env.HOARE_RUNTIME_DATA_DIR = dir;

  try {
    const { persistRuntime } = await import("../lib/hoare/deployment/runtime-store");
    const { runtimeSupervisor } = await import("../lib/hoare/deployment/runtime-supervisor");
    await persistRuntime({
      manifest: { version: "1", deploymentId, tenantId: "t", projectId: "p", applicationId: "a", releaseDigest: "r", target: "owned-runtime", status: "ready", controlPlane: "hoare", edgeAdapter: "none" },
      runtime: { deploymentId, applicationId: "a", releaseDigest: "r", runtime: "hoare-owned-runtime", entrypoint: "frontend", healthPath: "/api/health", status: "ready", runtimeDigest: "digest" },
      workspace: { root: "generated/t/p/a", digest: "workspace", files: [] },
      createdAt: new Date().toISOString(),
    });

    let runtime = await runtimeSupervisor.start(deploymentId);
    assert.equal(runtime.runtime.lifecycle, "running");
    runtime = await runtimeSupervisor.restart(deploymentId);
    assert.equal(runtime.runtime.lifecycle, "running");
    assert.equal(runtime.runtime.generation, 1);
    runtime = await runtimeSupervisor.stop(deploymentId);
    assert.equal(runtime.runtime.lifecycle, "stopped");
    assert.equal(runtime.runtime.lastOperation?.type, "stop");
  } finally {
    if (previous === undefined) delete process.env.HOARE_RUNTIME_DATA_DIR;
    else process.env.HOARE_RUNTIME_DATA_DIR = previous;
    await rm(dir, { recursive: true, force: true });
  }
});
