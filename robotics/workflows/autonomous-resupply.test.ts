import assert from "node:assert/strict";
import test from "node:test";
import { runAutonomousResupplySimulation } from "./autonomous-resupply";

test("autonomous resupply workflow passes policy and simulation", () => {
  const result = runAutonomousResupplySimulation({
    missionId: "resupply-demo-001",
    vehicleId: "ugv-sim-001",
    origin: { x: 0, y: 0 },
    destination: { x: 10, y: 20 },
    payloadKg: 100,
    requestedBy: "hoare-demo",
  });

  assert.equal(result.status, "completed");
});
