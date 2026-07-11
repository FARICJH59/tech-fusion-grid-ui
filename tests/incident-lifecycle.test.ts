import test from "node:test";
import assert from "node:assert/strict";

import { IncidentManager } from "../lib/incidents/incident-manager";

test("incident manager supports detect-diagnose-remediate-verify-resolve lifecycle", () => {
  const manager = new IncidentManager();
  const incident = manager.create({
    tenantId: "tenant-1",
    service: "api",
    severity: "sev1",
    tenantImpact: "api unavailable",
    reason: "error rate spike",
  });

  const cause = manager.diagnose(incident.id, {
    errorRate: 0.2,
    latencyMs: 1500,
    failedChecks: ["/healthz"],
  });
  manager.remediate(incident.id, "rolled back to previous revision");
  manager.verify(incident.id, true);
  const resolved = manager.resolve(incident.id);

  assert.equal(cause, "health-check-failure");
  assert.equal(resolved?.status, "resolved");
  assert.equal(manager.timeline.list(incident.id).length >= 5, true);
});
