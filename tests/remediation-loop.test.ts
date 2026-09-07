import test from "node:test";
import assert from "node:assert/strict";

import { IncidentManager } from "../lib/incidents/incident-manager";
import { RollbackEngine } from "../lib/cloud/rollback-engine";
import { RemediationLoop } from "../lib/cloud/remediation-loop";
import { createTestTcxAuthority } from "./fixtures/tcx-authority-fixture";

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
      latencyMs: 90,
      errorRate: 0.001,
      checkedAt: new Date().toISOString(),
    };
  },
};

test("remediation loop rejects live rollback without TCX authority", async () => {
  const incidents = new IncidentManager();
  const incident = incidents.create({
    tenantId: "tenant-1",
    service: "api",
    severity: "sev1",
    tenantImpact: "degraded",
    reason: "latency spike",
  });

  const loop = new RemediationLoop(incidents, new RollbackEngine(cloud));
  await assert.rejects(
    () => loop.run({
      incidentId: incident.id,
      tenantId: "tenant-1",
      service: "api",
      region: "us-central1",
      fromRevision: "api-r2",
      toRevision: "api-r1",
      errorRate: 0.2,
      latencyMs: 1500,
    }),
    /tcx_authority_required_for_live_remediation/,
  );
});

test("remediation loop triggers rollback and resolves incident with TCX authority", async () => {
  const incidents = new IncidentManager();
  const incident = incidents.create({
    tenantId: "tenant-test",
    service: "api",
    severity: "sev1",
    tenantImpact: "degraded",
    reason: "latency spike",
  });

  const loop = new RemediationLoop(incidents, new RollbackEngine(cloud));
  const authority = await createTestTcxAuthority({ tenantId: "tenant-test" });
  const result = await loop.run({
    incidentId: incident.id,
    tenantId: "tenant-test",
    service: "api",
    region: "us-central1",
    fromRevision: "api-r2",
    toRevision: "api-r1",
    errorRate: 0.2,
    latencyMs: 1500,
    authority,
  });

  const updated = incidents.list().find((item) => item.id === incident.id);
  assert.equal(result, "rolled-back");
  assert.equal(updated?.status, "resolved");
});
