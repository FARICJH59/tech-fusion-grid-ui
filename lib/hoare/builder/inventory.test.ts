import test from "node:test";
import assert from "node:assert/strict";
import { filterFreshInventory, validateInventoryRecord, type ResourceInventorySnapshot } from "./resource-inventory";

const base = {
  id: "gpu-1", provider: "nvidia", region: "secure-east", environment: "production" as const,
  classification: "classified" as const, egressAllowed: false, accelerator: "gpu" as const,
  acceleratorModels: ["H200"], acceleratorCount: 8, cpu: 96, memoryGiB: 1024,
  availability: 0.9999, estimatedLatencyMs: 120, estimatedCostPerHour: 18,
  capabilities: ["llm-inference"], observedAt: "2026-08-18T12:00:00Z", expiresAt: "2026-08-18T13:00:00Z",
  source: "test", fingerprint: "sha256:test",
};

test("inventory rejects expired records", () => {
  const errors = validateInventoryRecord(base, new Date("2026-08-18T14:00:00Z"));
  assert.ok(errors.includes("inventory_expired"));
});

test("inventory returns only fresh records", () => {
  const snapshot: ResourceInventorySnapshot = { version: "1", generatedAt: "2026-08-18T12:00:00Z", source: "test", records: [base] };
  assert.equal(filterFreshInventory(snapshot, new Date("2026-08-18T12:30:00Z")).length, 1);
  assert.equal(filterFreshInventory(snapshot, new Date("2026-08-18T14:00:00Z")).length, 0);
});
