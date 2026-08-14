import assert from "node:assert/strict";
import test from "node:test";
import { buildProjectInventory } from "../inventory/project-inventory";
import { createPasorPlan } from "../pasor/execution-plan";
import { simulatePasorPlan } from "./simulator";

const inventory = buildProjectInventory({ tenant_id: "ten_0123456789abcdef0123456789abcdef", project_id: "proj_sim", owner: "FARICJH59", repository: "sim-project", revision: "abc123", files: ["package.json", "src/main.ts", "engine.cpp", "aegisc/main.aegis", "mcp/pasor/index.ts"] });
const plan = () => createPasorPlan(inventory);

test("simulation passes authorized plan", () => {
  const result = simulatePasorPlan(plan(), { principal: { id: "builder-1", roles: ["builder"] }, tenant: { tenant_id: inventory.tenant_id, energy_quota: 1000, execution_quota: 1000 }, action: "build" });
  assert.equal(result.status, "PASS");
  assert.equal(result.allowed, true);
  assert.ok(result.parallel_groups.length > 0);
});

test("simulation denies tenant and quota violations", () => {
  const result = simulatePasorPlan(plan(), { principal: { id: "builder-1", roles: ["builder"] }, tenant: { tenant_id: "wrong-tenant", energy_quota: 1, execution_quota: 1 }, action: "build" });
  assert.equal(result.status, "DENY");
  assert.ok(result.reasons.includes("TENANT_MISMATCH"));
  assert.ok(result.reasons.includes("ENERGY_QUOTA_EXCEEDED"));
  assert.ok(result.reasons.includes("EXECUTION_QUOTA_EXCEEDED"));
});

test("simulation denies unauthorized role", () => {
  const result = simulatePasorPlan(plan(), { principal: { id: "viewer-1", roles: ["viewer"] }, tenant: { tenant_id: inventory.tenant_id, energy_quota: 1000, execution_quota: 1000 }, action: "build" });
  assert.equal(result.status, "DENY");
  assert.ok(result.reasons.includes("RBAC_DENIED"));
});
