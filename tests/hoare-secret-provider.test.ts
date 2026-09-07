import test from "node:test";
import assert from "node:assert/strict";
import { GcpSecretManagerProvider } from "@/lib/hoare/secrets/gcp-secret-manager-provider";

const request = (overrides: Record<string, unknown> = {}) => ({
  tenantId: "tenant-a",
  projectId: "project-a",
  transactionId: "tx-a",
  attemptId: "attempt-a",
  secretId: "cloudflare-api-token",
  authority: {} as never,
  ...overrides,
});

test("secret provider rejects an unbound tenant secret before touching Secret Manager", async () => {
  let calls = 0;
  const provider = new GcpSecretManagerProvider({
    projectId: "project-a",
    tenantSecretBinding: new Map([["tenant-a", new Set(["allowed-secret"])]]),
    client: {
      accessSecretVersion: async () => {
        calls += 1;
        throw new Error("must_not_call");
      },
    },
  });

  await assert.rejects(provider.getSecret(request()), /secret_tenant_binding_invalid/);
  assert.equal(calls, 0);
});

test("secret provider rejects a cross-project request before touching Secret Manager", async () => {
  let calls = 0;
  const provider = new GcpSecretManagerProvider({
    projectId: "project-a",
    tenantSecretBinding: new Map([["tenant-a", new Set(["cloudflare-api-token"])]]),
    client: {
      accessSecretVersion: async () => {
        calls += 1;
        throw new Error("must_not_call");
      },
    },
  });

  await assert.rejects(provider.getSecret(request({ projectId: "project-b" })), /secret_project_mismatch/);
  assert.equal(calls, 0);
});

test("secret provider rejects a forged authority before touching Secret Manager", async () => {
  let calls = 0;
  const provider = new GcpSecretManagerProvider({
    projectId: "project-a",
    tenantSecretBinding: new Map([["tenant-a", new Set(["cloudflare-api-token"])]]),
    client: {
      accessSecretVersion: async () => {
        calls += 1;
        throw new Error("must_not_call");
      },
    },
  });

  await assert.rejects(provider.getSecret(request()), /tcx_execution_authority/);
  assert.equal(calls, 0);
});

test("secret provider requires a project", () => {
  assert.throws(
    () =>
      new GcpSecretManagerProvider({
        projectId: "  ",
        tenantSecretBinding: new Map(),
      }),
    /secret_manager_project_required/,
  );
});
