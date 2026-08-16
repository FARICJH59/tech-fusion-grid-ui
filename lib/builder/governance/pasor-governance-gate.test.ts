import assert from "node:assert/strict";
import test from "node:test";
import { governExecutionUnit } from "./pasor-governance-gate";

const unit = {
  unit_id: "u1",
  command_id: "build.project",
  energy_cost: 5,
  quota_cost: 2,
};

const base = {
  tenantId: "tenant-a",
  projectId: "project-a",
  principalId: "principal-a",
  carbonIntensity: 1,
  rbacAllowed: true,
  policyAllowed: true,
};

test("allows governed execution inside resource budgets", () => {
  const result = governExecutionUnit(unit, { ...base, energyBudget: 10, quotaBudget: 5, carbonBudget: 10 });
  assert.equal(result.disposition, "EXECUTE");
});

test("denies before economics when RBAC or policy fails", () => {
  assert.equal(governExecutionUnit(unit, { ...base, rbacAllowed: false }).reason, "RBAC_DENIED");
  assert.equal(governExecutionUnit(unit, { ...base, policyAllowed: false }).reason, "POLICY_DENIED");
});

test("defers optional units when resource budgets are exceeded", () => {
  const result = governExecutionUnit({ ...unit, optional: true }, { ...base, energyBudget: 1 });
  assert.equal(result.disposition, "DEFER");
  assert.equal(result.reason, "ENERGY_BUDGET");
});
