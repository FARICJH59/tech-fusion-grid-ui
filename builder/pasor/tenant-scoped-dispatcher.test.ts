import assert from "node:assert/strict";
import test from "node:test";
import { PasorExecutionDispatcher } from "./execution-dispatcher";
import { TenantScopedPasorDispatcher } from "./tenant-scoped-dispatcher";

const plan = {
  execution_units: [
    {
      unit_id: "u1",
      command_id: "runtime.restart",
      parameters: {},
      dependencies: [],
      energy_cost: 1,
      quota_cost: 1,
      simulation_hash: "sim",
      provenance_hash: "prov",
      optional: false,
    },
  ],
};

const context = {
  tenantId: "tenant-acme",
  simulationApproved: true,
  governanceApproved: true,
  provenanceVerified: true,
  quotaAvailable: true,
  tenantScope: {
    tenantId: "tenant-acme",
    projectId: "commerce-prod",
    targetId: "checkout-api",
    environment: "production" as const,
    resourceId: "cloud-run:checkout-api",
    provider: "gcp",
    policyVersion: "policy-v1",
    authorizedActions: ["runtime.restart"],
  },
};

test("allows an authorized tenant action", async () => {
  const base = new PasorExecutionDispatcher();
  const dispatcher = new TenantScopedPasorDispatcher(base);
  dispatcher.register("runtime.restart", async () => ({ recovered: true }));

  const outcomes = await dispatcher.dispatch(plan, context);
  assert.equal(outcomes[0].status, "executed");
});

test("blocks an action not authorized by the tenant scope", async () => {
  const base = new PasorExecutionDispatcher();
  const dispatcher = new TenantScopedPasorDispatcher(base);
  dispatcher.register("runtime.restart", async () => ({ recovered: true }));

  const outcomes = await dispatcher.dispatch(plan, {
    ...context,
    tenantScope: { ...context.tenantScope, authorizedActions: [] },
  });

  assert.equal(outcomes[0].status, "blocked");
  assert.equal(outcomes[0].reason, "TENANT_ACTION_NOT_AUTHORIZED");
});
