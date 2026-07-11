import test from "node:test";
import assert from "node:assert/strict";

import { EvaluationRegistry, calculateQualityScore } from "../../packages/agent-sdk/src";

test("evaluation framework records tests and computes quality metrics", () => {
  const registry = new EvaluationRegistry();
  const qualityScore = calculateQualityScore({
    successRate: 0.99,
    latencyMs: 180,
    costUsd: 0.42,
    safetyScore: 0.97,
    reliabilityScore: 0.95,
  });

  const result = registry.record({
    agentId: "agent-1",
    timestamp: new Date().toISOString(),
    tests: [
      { id: "capability-contract", type: "capability", passed: true },
      { id: "workflow-contract", type: "workflow", passed: true },
    ],
    metrics: {
      successRate: 0.99,
      latencyMs: 180,
      costUsd: 0.42,
      safetyScore: 0.97,
      reliabilityScore: 0.95,
    },
    summary: "All capability and workflow checks passed.",
    qualityScore,
  });

  assert.equal(result.qualityScore > 90, true);
  assert.equal(registry.latest("agent-1")?.tests.length, 2);
});
