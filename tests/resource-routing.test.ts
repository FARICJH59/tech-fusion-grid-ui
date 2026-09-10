import test from "node:test";
import assert from "node:assert/strict";

import {
  ResourceAwareRouter,
  createDefaultResourceAwareRouter,
} from "../lib/enterprise/resource-routing";

test("resource router selects low-latency edge when requirements allow it", () => {
  const router = createDefaultResourceAwareRouter();
  const route = router.route({
    tenantId: "tenant-1",
    maxLatencyMs: 500,
    maxEnergyWh: 2,
    maxCarbonGramsCo2e: 5,
    preferEdge: true,
    allowCloud: true,
  });

  assert.equal(route.decision, "ALLOW");
  assert.equal(route.primary, "edge-local");
  assert.equal(route.failover, "edge-local");
});

test("resource router escalates when no candidate satisfies the SLO", () => {
  const router = createDefaultResourceAwareRouter();
  const route = router.route({
    tenantId: "tenant-2",
    maxLatencyMs: 50,
    allowCloud: true,
  });

  assert.equal(route.decision, "ESCALATE");
  assert.equal(route.primary, null);
  assert.ok(route.reason.includes("no_execution_candidate_satisfies_requirements"));
});

test("resource router can rank a custom fleet by latency and resource constraints", () => {
  const router = new ResourceAwareRouter([
    {
      region: "slow-edge",
      healthy: true,
      edgeEnabled: true,
      estimatedLatencyMs: 400,
      quotaRemaining: 100,
      energyWh: 1,
      carbonGramsCo2e: 1,
      estimatedCostUsd: 0.001,
      capacityUnits: 50,
    },
    {
      region: "fast-edge",
      healthy: true,
      edgeEnabled: true,
      estimatedLatencyMs: 100,
      quotaRemaining: 100,
      energyWh: 1,
      carbonGramsCo2e: 1,
      estimatedCostUsd: 0.001,
      capacityUnits: 50,
    },
  ]);

  const route = router.route({
    tenantId: "tenant-3",
    maxLatencyMs: 500,
    preferEdge: true,
    allowCloud: true,
  });

  assert.equal(route.primary, "fast-edge");
});
