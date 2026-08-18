import assert from "node:assert/strict";
import test from "node:test";
import { ClosedLoopSelfHealingOrchestrator } from "./closed-loop-orchestrator";
import { createSafeRemediationRegistry } from "./remediation-handlers";

function harness(recovered: boolean) {
  const meterEvents: unknown[] = [];
  const orchestrator = new ClosedLoopSelfHealingOrchestrator(
    createSafeRemediationRegistry(),
    { verify: async () => recovered },
    { record: async (event) => meterEvents.push(event) },
  );
  return { orchestrator, meterEvents };
}

const base = {
  tenantId: "tenant-1",
  target: "hoare",
  incidentId: "incident-1",
  command: "runtime.restart" as const,
  parameters: { service: "hoare-api" },
  simulationAllowed: true,
  governanceAllowed: true,
  provenanceVerified: true,
  quotaAvailable: true,
  recoveryExpected: true,
};

test("records a billable event only after verified recovery", async () => {
  const { orchestrator, meterEvents } = harness(true);
  const result = await orchestrator.execute(base);
  assert.equal(result.status, "RECOVERED");
  assert.equal(result.billable, true);
  assert.equal(meterEvents.length, 1);
});

test("failed recovery is not billable", async () => {
  const { orchestrator, meterEvents } = harness(false);
  const result = await orchestrator.execute(base);
  assert.equal(result.status, "FAILED");
  assert.equal(result.billable, false);
  assert.equal(meterEvents.length, 0);
});

test("denied execution never reaches metering", async () => {
  const { orchestrator, meterEvents } = harness(true);
  const result = await orchestrator.execute({ ...base, governanceAllowed: false });
  assert.equal(result.status, "DENIED");
  assert.equal(result.billable, false);
  assert.equal(meterEvents.length, 0);
});
