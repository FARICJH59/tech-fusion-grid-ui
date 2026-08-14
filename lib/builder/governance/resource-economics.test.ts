import assert from "node:assert/strict";
import test from "node:test";
import { evaluateResourceEconomics } from "./resource-economics";

test("allows work inside all budgets", () => {
  const result = evaluateResourceEconomics({
    energyCost: 5,
    quotaCost: 2,
    carbonIntensity: 1,
    energyBudget: 10,
    quotaBudget: 5,
    carbonBudget: 10,
  });
  assert.equal(result.allowed, true);
  assert.equal(result.deferred, false);
});

test("defers work over energy, quota, or carbon budget", () => {
  assert.equal(evaluateResourceEconomics({ energyCost: 11, quotaCost: 1, carbonIntensity: 1, energyBudget: 10 }).reason, "ENERGY_BUDGET");
  assert.equal(evaluateResourceEconomics({ energyCost: 1, quotaCost: 11, carbonIntensity: 1, quotaBudget: 10 }).reason, "QUOTA_BUDGET");
  assert.equal(evaluateResourceEconomics({ energyCost: 1, quotaCost: 1, carbonIntensity: 11, carbonBudget: 10 }).reason, "CARBON_BUDGET");
});
