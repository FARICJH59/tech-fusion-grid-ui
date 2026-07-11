import test from "node:test";
import assert from "node:assert/strict";

import { chaosRunner } from "../lib/testing/chaos-runner";

test("chaos runner executes DR scenarios and produces reliability metrics", () => {
  const result = chaosRunner.run("tenant-1", [
    "failed-deployment",
    "redis-outage",
    "mqtt-broker-failure",
    "database-recovery",
  ]);

  assert.equal(result.reports.length, 4);
  assert.equal(result.averageRecoveryMs > 0, true);
  assert.equal(result.reliabilityScore > 0, true);
});
