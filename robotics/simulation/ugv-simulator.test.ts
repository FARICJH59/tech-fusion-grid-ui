import assert from "node:assert/strict";
import test from "node:test";
import { simulateUgvMission } from "./ugv-simulator";
import type { ResupplyMission } from "../core/types";

const mission: ResupplyMission = {
  missionId: "resupply-demo-001",
  vehicleId: "ugv-sim-001",
  origin: { x: 0, y: 0 },
  destination: { x: 10, y: 20 },
  payloadKg: 100,
  requestedBy: "hoare-demo",
};

test("simulated UGV completes resupply mission", () => {
  const result = simulateUgvMission(mission);

  assert.equal(result.status, "completed");
  assert.equal(result.finalState.status, "completed");
  assert.deepEqual(result.finalState.position, {
    x: 10,
    y: 20,
  });
});
