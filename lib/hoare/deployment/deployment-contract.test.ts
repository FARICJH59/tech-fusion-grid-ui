import test from "node:test";
import assert from "node:assert/strict";
import { createDeploymentManifest, markDeploymentReady, validateDeploymentManifest } from "./deployment-contract";
import { provisionOwnedRuntime } from "./owned-runtime";

test("HOARE native deployment creates a deterministic HOARE-owned deployment manifest", () => {
  const intent = {
    tenantId: "tenant-1",
    projectId: "project-1",
    applicationId: "app-1",
    releaseDigest: "a".repeat(64),
    target: "owned-runtime" as const,
    domain: "inventory.example.com",
  };
  const a = createDeploymentManifest(intent);
  const b = createDeploymentManifest(intent);
  assert.deepEqual(a, b);
  assert.equal(a.controlPlane, "hoare");
  assert.equal(a.edgeAdapter, "cloudflare");
  validateDeploymentManifest(a);
  const ready = markDeploymentReady(a);
  const runtime = provisionOwnedRuntime(ready);
  assert.equal(ready.status, "ready");
  assert.equal(runtime.runtime, "hoare-owned-runtime");
  assert.equal(runtime.hostname, "inventory.example.com");
});
