import test from "node:test";
import assert from "node:assert/strict";

import { failoverController } from "../lib/dr/failover-controller";
import { runRecoveryTest } from "../lib/dr/recovery-test";
import { backupManager } from "../lib/dr/backup-manager";

test("dr failover evacuates unhealthy primary and validates recovery", () => {
  backupManager.run("tenant-1", "us-central1", "cloud-run/api");

  const result = failoverController.orchestrate({
    tenantId: "tenant-1",
    primaryRegion: { region: "us-central1", healthy: false, latencyMs: 1800 },
    secondaryRegion: { region: "us-east1", healthy: true, latencyMs: 250 },
  });

  const validation = runRecoveryTest(result);

  assert.equal(result.action, "evacuate");
  assert.equal(validation.failoverHealthy, true);
  assert.equal(backupManager.list("tenant-1").length > 0, true);
});
