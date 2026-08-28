import assert from "node:assert/strict";
import test from "node:test";
import { admitRoboticsMission } from "./admission";

test("valid robotics mission is admitted", () => {
  const result = admitRoboticsMission({
    missionId: "admission-001",
    vehicleId: "ugv-sim-001",
    origin: { x: 0, y: 0 },
    destination: { x: 10, y: 20 },
    payloadKg: 100,
    requestedBy: "hoare-demo",
  });

  assert.equal(result.status, "admitted");
  assert.deepEqual(result.reasons, []);
  assert.equal(result.simulationOnly, true);
  assert.equal(result.mutationExecuted, false);
});

test("invalid robotics mission is rejected", () => {
  const result = admitRoboticsMission({
    missionId: "admission-002",
    vehicleId: "",
    origin: { x: 0, y: 0 },
    destination: { x: 10, y: 20 },
    payloadKg: 0,
    requestedBy: "",
  });

  assert.equal(result.status, "rejected");
  assert.equal(result.simulationOnly, true);
  assert.equal(result.mutationExecuted, false);
  assert.equal(result.reasons.length, 3);
});
