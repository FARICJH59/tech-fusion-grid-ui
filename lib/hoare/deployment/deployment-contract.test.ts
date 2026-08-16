import { describe, expect, it } from "vitest";
import { createDeploymentManifest, markDeploymentReady, validateDeploymentManifest } from "./deployment-contract";
import { provisionOwnedRuntime } from "./owned-runtime";

describe("HOARE native deployment control", () => {
  it("creates a deterministic HOARE-owned deployment manifest", () => {
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

    expect(a).toEqual(b);
    expect(a.controlPlane).toBe("hoare");
    expect(a.edgeAdapter).toBe("cloudflare");
    validateDeploymentManifest(a);

    const ready = markDeploymentReady(a);
    const runtime = provisionOwnedRuntime(ready);
    expect(ready.status).toBe("ready");
    expect(runtime.runtime).toBe("hoare-owned-runtime");
    expect(runtime.hostname).toBe("inventory.example.com");
  });
});
