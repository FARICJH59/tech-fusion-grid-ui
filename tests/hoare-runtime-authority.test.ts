import assert from "node:assert/strict";
import test from "node:test";
import { GcpRuntimeProvider } from "../lib/hoare/runtime/gcp-provider";
import type { GovernedExecutionAuthority } from "../lib/hoare/runtime/governed-execution-authority";

function application() {
  return {
    id: "app-1",
    tenantId: "tenant-1",
    name: "app-1",
    status: "validated",
    image: "us-docker.pkg.dev/example/app:sha",
  } as never;
}

function node() {
  return { id: "node-1", tenantId: "tenant-1" } as never;
}

function authority(overrides: Partial<GovernedExecutionAuthority> = {}): GovernedExecutionAuthority {
  return {
    transactionId: "tx-1",
    attemptId: "attempt-1",
    tenantId: "tenant-1",
    leaseId: "lease-1",
    stateVersion: 4,
    authorizationDecisionId: "decision-1",
    verificationProofId: "proof-1",
    assertValid: async () => undefined,
    ...overrides,
  };
}

test("GCP runtime fails closed without TCX authority", async () => {
  let deployed = false;
  const client = {
    projectId: "project-1",
    region: "us-east1",
    deployService: async () => {
      deployed = true;
      return { latestRevision: "rev-1" };
    },
  } as never;

  const provider = new GcpRuntimeProvider(client);
  await assert.rejects(
    provider.deploy({ application: application(), node: node() }),
    /tcx_authority_required_for_live_gcp_execution/,
  );
  assert.equal(deployed, false);
});

test("GCP runtime validates authority immediately before Cloud Run mutation", async () => {
  const calls: string[] = [];
  const client = {
    projectId: "project-1",
    region: "us-east1",
    deployService: async () => {
      calls.push("deploy");
      return { latestRevision: "rev-1" };
    },
  } as never;

  const governed = authority({
    assertValid: async () => {
      calls.push("validate");
    },
  });

  const provider = new GcpRuntimeProvider(client);
  const result = await provider.deploy({ application: application(), node: node(), authority: governed });

  assert.equal(result.mode, "live");
  assert.deepEqual(calls, ["validate", "deploy"]);
});

test("GCP runtime rejects a cross-tenant authority before mutation", async () => {
  let deployed = false;
  const client = {
    projectId: "project-1",
    region: "us-east1",
    deployService: async () => {
      deployed = true;
      return { latestRevision: "rev-1" };
    },
  } as never;

  const provider = new GcpRuntimeProvider(client);
  await assert.rejects(
    provider.deploy({ application: application(), node: node(), authority: authority({ tenantId: "tenant-2" }) }),
    /tcx_authority_tenant_mismatch/,
  );
  assert.equal(deployed, false);
});

test("GCP runtime rejects authority without AEGIS proof binding", async () => {
  let deployed = false;
  const client = {
    projectId: "project-1",
    region: "us-east1",
    deployService: async () => {
      deployed = true;
      return { latestRevision: "rev-1" };
    },
  } as never;

  const provider = new GcpRuntimeProvider(client);
  await assert.rejects(
    provider.deploy({ application: application(), node: node(), authority: authority({ verificationProofId: "" }) }),
    /tcx_authority_proof_binding_required/,
  );
  assert.equal(deployed, false);
});
