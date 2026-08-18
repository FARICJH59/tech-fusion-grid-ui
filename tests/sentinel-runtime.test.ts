import assert from "node:assert/strict";
import test from "node:test";
import { SentinelRuntime } from "../agentfusion/sentinel/sentinel-runtime";

test("Sentinel isolates a matching critical event in autonomous mode", () => {
  const sentinel = new SentinelRuntime({ id: "sentinel-1", mode: "AUTONOMOUS_DEFENSE", criticalEventTypes: ["overvoltage"], allowedActions: ["network.isolate", "evidence.capture"] });
  const result = sentinel.evaluate({ tenantId: "t", deviceId: "d", eventType: "overvoltage", severity: "critical" });
  assert.equal(result.decision, "ISOLATE");
  assert.deepEqual(result.actions, ["network.isolate", "evidence.capture"]);
});

test("Sentinel escalates in advisory mode", () => {
  const sentinel = new SentinelRuntime({ id: "sentinel-1", mode: "ADVISORY", criticalEventTypes: ["overvoltage"], allowedActions: ["network.isolate"] });
  const result = sentinel.evaluate({ tenantId: "t", deviceId: "d", eventType: "overvoltage", severity: "critical" });
  assert.equal(result.decision, "ESCALATE");
});
