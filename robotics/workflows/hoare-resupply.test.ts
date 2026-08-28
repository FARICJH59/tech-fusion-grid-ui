import assert from "node:assert/strict";
import test from "node:test";
import { executeGovernedResupplySimulation } from "./hoare-resupply";

test("HOARE governs simulated UGV resupply", () => {
  const result = executeGovernedResupplySimulation({
    missionId: "resupply-hoare-001",
    vehicleId: "ugv-sim-001",
    origin: { x: 0, y: 0 },
    destination: { x: 10, y: 20 },
    payloadKg: 100,
    requestedBy: "hoare-demo",
  });

  assert.equal(result.admitted, true);
  assert.equal(result.simulation?.status, "completed");
  assert.equal(result.receipt.simulationOnly, true);
  assert.equal(result.receipt.mutationExecuted, false);
});

test("HOARE rejects invalid robotics mission", () => {
  const result = executeGovernedResupplySimulation({
    missionId: "resupply-invalid-001",
    vehicleId: "",
    origin: { x: 0, y: 0 },
    destination: { x: 10, y: 20 },
    payloadKg: 0,
    requestedBy: "",
  });

  assert.equal(result.admitted, false);
  assert.equal(result.simulation, null);
  assert.equal(result.receipt.status, "rejected");
  assert.equal(result.receipt.simulationOnly, true);
  assert.equal(result.receipt.mutationExecuted, false);
});
