import test from "node:test";
import assert from "node:assert/strict";

import { RollbackEngine } from "../lib/cloud/rollback-engine";
import type { GovernedExecutionAuthority } from "../lib/hoare/runtime/governed-execution-authority";

const authority: GovernedExecutionAuthority = {
  transactionId: "tx-rollback",
  attemptId: "attempt-rollback",
  tenantId: "tenant-1",
  leaseId: "lease-rollback",
  stateVersion: 7,
  authorizationDecisionId: "decision-rollback",
  verificationProofId: "proof-rollback",
  async assertValid() {},
};

const cloud = {
  async updateTraffic(service: string, region: string, traffic: Array<{ revision: string; percent: number }>) {
    return {
      service,
      region,
      latestRevision: traffic[0].revision,
      traffic,
      status: "healthy" as const,
      observedAt: new Date().toISOString(),
    };
  },
  async verifyHealth(service: string) {
    return {
      service,
      healthy: true,
      latencyMs: 120,
      errorRate: 0.001,
      checkedAt: new Date().toISOString(),
    };
  },
};

test("rollback engine executes revision and traffic rollback with audit", async () => {
  const engine = new RollbackEngine(cloud);
  const result = await engine.execute({
    tenantId: "tenant-1",
    service: "api",
    region: "us-central1",
    fromRevision: "api-r2",
    toRevision: "api-r1",
    trigger: "failed-verification",
    reason: "verification failure",
    authority,
  });

  assert.equal(result.success, true);
  assert.equal(result.verificationPassed, true);
  assert.equal(engine.listAudit().length, 1);
});

test("rollback engine fails closed before live traffic mutation without TCX authority", async () => {
  let calls = 0;
  const guardedCloud = {
    ...cloud,
    async updateTraffic(service: string, region: string, traffic: Array<{ revision: string; percent: number }>) {
      calls += 1;
      return cloud.updateTraffic(service, region, traffic);
    },
  };
  const engine = new RollbackEngine(guardedCloud);

  await assert.rejects(
    engine.execute({
      tenantId: "tenant-1",
      service: "api",
      region: "us-central1",
      fromRevision: "api-r2",
      toRevision: "api-r1",
      trigger: "failed-verification",
      reason: "verification failure",
    }),
    /tcx_authority_required_for_live_rollback/,
  );
  assert.equal(calls, 0);
});

test("rollback engine rejects an authority belonging to another tenant", async () => {
  const engine = new RollbackEngine(cloud);
  await assert.rejects(
    engine.execute({
      tenantId: "tenant-2",
      service: "api",
      region: "us-central1",
      fromRevision: "api-r2",
      toRevision: "api-r1",
      trigger: "failed-verification",
      reason: "verification failure",
      authority,
    }),
    /tcx_authority_tenant_mismatch/,
  );
});
