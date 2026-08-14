import assert from "node:assert/strict";
import test from "node:test";
import { simulatePlan } from "../builder/governance";
import type { ExecutionPlan } from "../builder/contracts/execution-plan";

const plan: ExecutionPlan = {
  project_id: "proj-qgps-qae",
  tenant_id: "tenant_demo",
  execution_id: "exec_001",
  version: "1.0",
  intent: "Detect QGPS signal anomalies with a quantum autoencoder",
  created_at: "2026-08-14T00:00:00.000Z",
  plan_hash: "plan-test",
  execution_units: [
    {
      unit_id: "step1",
      command_id: "ml.load_data",
      parameters: {},
      dependencies: [],
      energy_cost: 6,
      quota_cost: 1,
      tenant_id: "tenant_demo",
      project_id: "proj-qgps-qae",
      execution_id: "exec_001",
      simulation_hash: "sim1",
      provenance_hash: "prov1",
      status: "PLANNED",
    },
    {
      unit_id: "step2",
      command_id: "ml.train_model",
      parameters: {},
      dependencies: ["step1"],
      energy_cost: 60,
      quota_cost: 6,
      tenant_id: "tenant_demo",
      project_id: "proj-qgps-qae",
      execution_id: "exec_001",
      simulation_hash: "sim2",
      provenance_hash: "prov2",
      status: "PLANNED",
    },
  ],
};

test("governance simulation allows an in-budget plan", () => {
  const result = simulatePlan(plan, {
    energy_budget: 100,
    quota_budget: 20,
    carbon_budget: 100,
    role: "builder",
    allowed_actions: ["ml.load_data", "ml.train_model"],
    tenant_active: true,
  });

  assert.equal(result.decision, "ALLOW");
  assert.equal(result.total_energy, 66);
  assert.equal(result.total_quota, 7);
});

test("governance simulation denies energy overrun before execution", () => {
  const result = simulatePlan(plan, {
    energy_budget: 50,
    quota_budget: 20,
    role: "builder",
    allowed_actions: ["ml.load_data", "ml.train_model"],
    tenant_active: true,
  });

  assert.equal(result.decision, "DENY");
  assert.equal(result.units[1].reason, "ENERGY_BUDGET_EXCEEDED");
});

test("governance simulation enforces RBAC", () => {
  const result = simulatePlan(plan, {
    energy_budget: 100,
    quota_budget: 20,
    role: "viewer",
    allowed_actions: ["ml.load_data", "ml.train_model"],
    tenant_active: true,
  });

  assert.equal(result.decision, "DENY");
  assert.equal(result.units[1].reason, "RBAC_DENIED");
});
