import test from "node:test";
import assert from "node:assert/strict";

import { RollbackEngine } from "../lib/cloud/rollback-engine";

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
  });

  assert.equal(result.success, true);
  assert.equal(result.verificationPassed, true);
  assert.equal(engine.listAudit().length, 1);
});
