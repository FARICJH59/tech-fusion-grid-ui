import assert from "node:assert/strict";
import test from "node:test";
import { executeSelfHealing, planSelfHealing } from "./self-healing-controller";

const policy = {
  allowedActions: ["restart", "scale", "rollback"] as const,
  maxAttempts: 2,
  autonomousSeverities: ["medium", "high", "critical"] as const,
};

const incident = {
  incidentId: "inc-001",
  service: "hoare-api",
  symptom: "health check failures",
  severity: "medium" as const,
  observedAt: "2026-08-14T00:00:00Z",
};

test("plans a deterministic governed remediation unit", () => {
  const a = planSelfHealing(incident, policy);
  const b = planSelfHealing(incident, policy);
  assert.equal(a.decision, "REMEDIATE");
  assert.equal(a.units[0]?.simulationHash, b.units[0]?.simulationHash);
  assert.equal(a.units[0]?.provenanceHash, b.units[0]?.provenanceHash);
});

test("escalates when autonomous remediation is not allowed", () => {
  const result = planSelfHealing({ ...incident, severity: "low" }, policy);
  assert.equal(result.decision, "ESCALATE");
  assert.equal(result.reason, "SEVERITY_REQUIRES_REVIEW");
});

test("never executes when simulation denies remediation", async () => {
  const decision = planSelfHealing(incident, policy);
  let executed = false;
  const result = await executeSelfHealing(decision, {
    simulate: async () => false,
    authorize: async () => true,
    execute: async () => { executed = true; },
    verify: async () => true,
  }, incident, 2);

  assert.equal(result.recovered, false);
  assert.equal(result.reason, "SIMULATION_DENIED");
  assert.equal(executed, false);
});

test("verifies recovery after governed execution", async () => {
  const decision = planSelfHealing(incident, policy);
  const result = await executeSelfHealing(decision, {
    simulate: async () => true,
    authorize: async () => true,
    execute: async () => undefined,
    verify: async () => true,
  }, incident, 2);

  assert.equal(result.recovered, true);
  assert.equal(result.reason, "RECOVERY_VERIFIED");
  assert.equal(result.attempts, 1);
});

test("escalates after bounded failed recovery attempts", async () => {
  const decision = planSelfHealing(incident, policy);
  const result = await executeSelfHealing(decision, {
    simulate: async () => true,
    authorize: async () => true,
    execute: async () => undefined,
    verify: async () => false,
  }, incident, 2);

  assert.equal(result.recovered, false);
  assert.equal(result.reason, "RECOVERY_FAILED_ESCALATE");
  assert.equal(result.attempts, 2);
});
