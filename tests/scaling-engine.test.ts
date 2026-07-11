import test from "node:test";
import assert from "node:assert/strict";

import { IntelligentScalingEngine } from "../lib/cloud/scaling-engine";

const engine = new IntelligentScalingEngine();

test("scaling engine chooses scale-up when SLA is breached", () => {
  const decision = engine.decide({
    tenantId: "tenant-1",
    service: "api",
    cpuUtilization: 0.9,
    memoryUtilization: 0.8,
    requestLatencyMs: 1200,
    errorRate: 0.01,
    requestVolumePerMinute: 800,
    queueDepth: 250,
    tenantSlaLatencyMs: 500,
    budgetLimitUsd: 100,
    projectedCostUsd: 90,
    regionalAvailability: 0.9,
  });

  assert.equal(decision.decision, "scale-up");
  assert.equal(decision.requiresApproval, false);
});

test("scaling engine enables cost protection above budget", () => {
  const decision = engine.decide({
    tenantId: "tenant-1",
    service: "api",
    cpuUtilization: 0.2,
    memoryUtilization: 0.2,
    requestLatencyMs: 100,
    errorRate: 0.001,
    requestVolumePerMinute: 20,
    queueDepth: 1,
    tenantSlaLatencyMs: 500,
    budgetLimitUsd: 100,
    projectedCostUsd: 130,
    regionalAvailability: 0.9,
  });

  assert.equal(decision.decision, "cost-protect");
  assert.equal(decision.requiresApproval, true);
});
