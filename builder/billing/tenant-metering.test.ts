import assert from "node:assert/strict";
import test from "node:test";
import { createTenantMeteringEvent, IdempotentTenantMeter } from "./tenant-metering";

const input = {
  tenantId: "tenant-acme",
  projectId: "commerce-prod",
  targetId: "checkout-api",
  environment: "production" as const,
  unitId: "unit-1",
  commandId: "runtime.restart",
  actionId: "incident-1:runtime.restart",
  outcome: "RECOVERED" as const,
  quantity: 1,
  occurredAt: "2026-08-14T00:00:00Z",
  provenanceHash: "a".repeat(64),
};

test("creates deterministic tenant-scoped billable events", () => {
  const a = createTenantMeteringEvent(input);
  const b = createTenantMeteringEvent(input);
  assert.equal(a.eventId, b.eventId);
  assert.equal(a.billable, true);
  assert.equal(a.tenantId, "tenant-acme");
});

test("rejects non-positive usage", () => {
  assert.throws(() => createTenantMeteringEvent({ ...input, quantity: 0 }), /METER_QUANTITY_INVALID/);
});

test("deduplicates repeated events", async () => {
  const events: unknown[] = [];
  const meter = new IdempotentTenantMeter({ record: async (event) => events.push(event) });
  const event = createTenantMeteringEvent(input);
  await meter.record(event);
  await meter.record(event);
  assert.equal(events.length, 1);
});
