import assert from "node:assert/strict";
import test from "node:test";
import { InMemoryTenantLedger } from "./tenant-ledger";

test("aggregates usage and revenue per tenant", async () => {
  const ledger = new InMemoryTenantLedger();
  await ledger.append({ ledgerId: "1", tenantId: "t1", projectId: "p1", unitId: "u1", commandId: "build", status: "EXECUTED", quotaConsumed: 2, energyKwh: 4, carbonKg: 1, revenueUsd: 3, recordedAt: "now" });
  await ledger.append({ ledgerId: "2", tenantId: "t1", projectId: "p2", unitId: "u2", commandId: "test", status: "EXECUTED", quotaConsumed: 1, energyKwh: 2, carbonKg: 0.5, revenueUsd: 1.5, recordedAt: "now" });
  await ledger.append({ ledgerId: "3", tenantId: "t2", projectId: "p3", unitId: "u3", commandId: "build", status: "EXECUTED", quotaConsumed: 9, energyKwh: 9, carbonKg: 9, revenueUsd: 9, recordedAt: "now" });

  assert.deepEqual(await ledger.totals("t1"), { quotaConsumed: 3, energyKwh: 6, carbonKg: 1.5, revenueUsd: 4.5 });
  assert.equal((await ledger.list("t1", "p1")).length, 1);
  assert.equal((await ledger.list("t2")).length, 1);
});
