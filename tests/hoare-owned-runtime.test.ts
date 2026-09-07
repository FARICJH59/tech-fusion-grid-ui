import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const deploymentId = "dep_0123456789abcdef01234567";

test("owned runtime store persists a generated workspace", async () => {
  const dir = await mkdtemp(join(tmpdir(), "hoare-runtime-"));
  const previous = process.env.HOARE_RUNTIME_DATA_DIR;
  process.env.HOARE_RUNTIME_DATA_DIR = dir;

  try {
    const { persistRuntime, loadRuntime } = await import("../lib/hoare/deployment/runtime-store");
    const { createRuntimeServiceGraph } = await import("../lib/hoare/deployment/service-contract");
    const value = {
      manifest: {
        version: "1" as const,
        deploymentId,
        tenantId: "tenant-1",
        projectId: "project-1",
        applicationId: "app-1",
        releaseDigest: "release-1",
        target: "owned-runtime" as const,
        status: "ready" as const,
        controlPlane: "hoare" as const,
        edgeAdapter: "none" as const,
      },
      runtime: {
        deploymentId,
        applicationId: "app-1",
        releaseDigest: "release-1",
        runtime: "hoare-owned-runtime" as const,
        entrypoint: "frontend",
        healthPath: "/api/health",
        status: "ready" as const,
        runtimeDigest: "runtime-1",
        services: createRuntimeServiceGraph("app-1"),
      },
      workspace: {
        root: "generated/tenant-1/project-1/app-1",
        digest: "workspace-1",
        files: [{ path: "frontend/app/page.tsx", content: "export default function Home() { return null; }" }],
      },
      createdAt: new Date().toISOString(),
    };

    await persistRuntime(value);
    const loaded = await loadRuntime(deploymentId);
    assert.deepEqual(loaded, value);
    assert.equal(value.runtime.services.backend.public, false);
    assert.equal(value.runtime.services.frontend.port, 3000);
    assert.equal(value.runtime.services.backend.port, 8080);
  } finally {
    if (previous === undefined) delete process.env.HOARE_RUNTIME_DATA_DIR;
    else process.env.HOARE_RUNTIME_DATA_DIR = previous;
    await rm(dir, { recursive: true, force: true });
  }
});
