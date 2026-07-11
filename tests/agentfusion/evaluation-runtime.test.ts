import test from "node:test";
import assert from "node:assert/strict";

import { AgentEvaluationRuntime } from "../../agentfusion/evaluation/evaluation-runtime";

test("evaluation runtime tracks reliability, latency, cost, and tool efficiency", () => {
  const evaluation = new AgentEvaluationRuntime();
  evaluation.recordExecution({ agentId: "agent-1", success: true, latencyMs: 120, costUsd: 0.2, toolCalls: 2, toolFailures: 0, tokenUsage: 100 });
  evaluation.recordExecution({ agentId: "agent-1", success: false, latencyMs: 300, costUsd: 0.4, toolCalls: 2, toolFailures: 1, tokenUsage: 200 });

  const history = evaluation.performanceHistory("agent-1");
  assert.equal(history.executions, 2);
  assert.equal(history.failures, 1);
  assert.ok(history.toolEfficiency < 1);
  assert.ok(evaluation.latest("agent-1"));
});
