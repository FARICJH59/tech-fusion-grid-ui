import test from "node:test";
import assert from "node:assert/strict";
import { GcpSecretManagerProvider } from "@/lib/hoare/secrets/gcp-secret-manager-provider";
import { SecretAccessPolicyEngine, type SecretAccessPolicy } from "@/lib/hoare/secrets/secret-access-policy";

const policy: SecretAccessPolicy = {
  tenantId: "tenant-a",
  projectId: "project-a",
  secretId: "cloudflare-api-token",
  environment: "production",
  operations: new Set(["read"]),
  agentIds: new Set(["agent-a"]),
  workloadIds: new Set(["workload-a"]),
  nodeIds: new Set(["node-a"]),
  runtimeKinds: new Set(["cloud-run"]),
  secretVersions: new Set(["42"]),
};

const accessPolicy = new SecretAccessPolicyEngine(
  new Map([["tenant-a:project-a:cloudflare-api-token:production", policy]]),
);

const request = (overrides: Record<string, unknown> = {}) => ({
  tenantId: "tenant-a",
  projectId: "project-a",
  transactionId: "tx-a",
  attemptId: "attempt-a",
  secretId: "cloudflare-api-token",
  agentId: "agent-a",
  workloadId: "workload-a",
  environment: "production",
  operation: "read" as const,
  nodeId: "node-a",
  runtimeKind: "cloud-run",
  secretVersion: "42",
  authority: {} as never,
  ...overrides,
});

const providerOptions = (client: { accessSecretVersion: () => Promise<never> }) => ({
  projectId: "project-a",
  tenantSecretBinding: new Map([["tenant-a", new Set(["cloudflare-api-token"])]]),
  accessPolicy,
  client,
});

test("secret provider rejects an unbound tenant secret before touching Secret Manager", async () => {
  let calls = 0;
  const provider = new GcpSecretManagerProvider({
    ...providerOptions({
      accessSecretVersion: async () => {
        calls += 1;
        throw new Error("must_not_call");
      },
    }),
    tenantSecretBinding: new Map([["tenant-a", new Set(["allowed-secret"])]]),
  });

  await assert.rejects(provider.getSecret(request()), /secret_tenant_binding_invalid/);
  assert.equal(calls, 0);
});

test("secret provider rejects a cross-project request before touching Secret Manager", async () => {
  let calls = 0;
  const provider = new GcpSecretManagerProvider(
    providerOptions({
      accessSecretVersion: async () => {
        calls += 1;
        throw new Error("must_not_call");
      },
    }),
  );

  await assert.rejects(provider.getSecret(request({ projectId: "project-b" })), /secret_project_mismatch/);
  assert.equal(calls, 0);
});

// A forged authority must be rejected before policy evaluation. These tests intentionally
// assert the stronger fail-closed boundary instead of using a structurally fake authority
// to probe downstream policy decisions.
test("secret provider rejects a forged authority before policy evaluation for a denied agent", async () => {
  let calls = 0;
  const provider = new GcpSecretManagerProvider(
    providerOptions({
      accessSecretVersion: async () => {
        calls += 1;
        throw new Error("must_not_call");
      },
    }),
  );

  await assert.rejects(provider.getSecret(request({ agentId: "agent-b" })), /tcx_execution_authority_not_issuer_created/);
  assert.equal(calls, 0);
});

test("secret provider rejects a forged authority before policy evaluation for a denied environment", async () => {
  let calls = 0;
  const provider = new GcpSecretManagerProvider(
    providerOptions({
      accessSecretVersion: async () => {
        calls += 1;
        throw new Error("must_not_call");
      },
    }),
  );

  await assert.rejects(provider.getSecret(request({ environment: "staging" })), /tcx_execution_authority_not_issuer_created/);
  assert.equal(calls, 0);
});

test("secret provider rejects a forged authority before policy evaluation for a denied operation", async () => {
  let calls = 0;
  const provider = new GcpSecretManagerProvider(
    providerOptions({
      accessSecretVersion: async () => {
        calls += 1;
        throw new Error("must_not_call");
      },
    }),
  );

  await assert.rejects(provider.getSecret(request({ operation: "rotate" })), /tcx_execution_authority_not_issuer_created/);
  assert.equal(calls, 0);
});

test("secret provider rejects a forged authority before touching Secret Manager", async () => {
  let calls = 0;
  const provider = new GcpSecretManagerProvider(
    providerOptions({
      accessSecretVersion: async () => {
        calls += 1;
        throw new Error("must_not_call");
      },
    }),
  );

  await assert.rejects(provider.getSecret(request()), /tcx_execution_authority/);
  assert.equal(calls, 0);
});

test("secret provider requires a project", () => {
  assert.throws(
    () =>
      new GcpSecretManagerProvider({
        projectId: "  ",
        tenantSecretBinding: new Map(),
        accessPolicy,
      }),
    /secret_manager_project_required/,
  );
});
