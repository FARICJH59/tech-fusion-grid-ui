import test from "node:test";
import assert from "node:assert/strict";

import { IncidentManager } from "../lib/incidents/incident-manager";
import { RollbackEngine } from "../lib/cloud/rollback-engine";
import { RemediationLoop } from "../lib/cloud/remediation-loop";

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

test("remediation loop triggers rollback and resolves incident", async () => {
  const incidents = new IncidentManager();
  const incident = incidents.create({
    tenantId: "tenant-1",
    service: "api",
    severity: "sev1",
    tenantImpact: "degraded",
    reason: "latency spike",
  });

  const loop = new RemediationLoop(incidents, new RollbackEngine(cloud));
  const result = await loop.run({
    incidentId: incident.id,
    tenantId: "tenant-1",
    service: "api",
    region: "us-central1",
    fromRevision: "api-r2",
    toRevision: "api-r1",
    errorRate: 0.2,
    latencyMs: 1500,
  });

  const updated = incidents.list().find((item) => item.id === incident.id);
  assert.equal(result, "rolled-back");
  assert.equal(updated?.status, "resolved");
});
