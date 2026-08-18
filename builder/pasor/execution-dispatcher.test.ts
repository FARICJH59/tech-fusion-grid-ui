import assert from "node:assert/strict";
import test from "node:test";
import { PasorExecutionDispatcher } from "./execution-dispatcher";
import type { ExecutionUnit } from "./execution-plan";

const unit = (overrides: Partial<ExecutionUnit> = {}): ExecutionUnit => ({
  unit_id: "repair-1",
  command_id: "runtime.restart",
  parameters: { service: "hoare" },
  dependencies: [],
  energy_cost: 1,
  quota_cost: 1,
  simulation_hash: "a".repeat(64),
  provenance_hash: "b".repeat(64),
  ...overrides,
});

test("dispatches an approved execution unit", async () => {
  const dispatcher = new PasorExecutionDispatcher();
  dispatcher.register("runtime.restart", async (executionUnit) => executionUnit.parameters.service);

  const outcomes = await dispatcher.dispatch({ execution_units: [unit()] }, {
    tenantId: "tenant-1",
    simulationApproved: true,
    governanceApproved: true,
    provenanceVerified: true,
    quotaAvailable: true,
  });

  assert.equal(outcomes[0].status, "executed");
  assert.equal(outcomes[0].result, "hoare");
});

test("blocks execution when governance denies it", async () => {
  const dispatcher = new PasorExecutionDispatcher();
  let called = false;
  dispatcher.register("runtime.restart", async () => { called = true; });

  const outcomes = await dispatcher.dispatch({ execution_units: [unit()] }, {
    tenantId: "tenant-1",
    simulationApproved: true,
    governanceApproved: false,
    provenanceVerified: true,
    quotaAvailable: true,
  });

  assert.equal(outcomes[0].status, "blocked");
  assert.equal(outcomes[0].reason, "GOVERNANCE_DENIED");
  assert.equal(called, false);
});

test("honors execution dependencies", async () => {
  const dispatcher = new PasorExecutionDispatcher();
  const order: string[] = [];
  dispatcher.register("prepare", async () => { order.push("prepare"); });
  dispatcher.register("repair", async () => { order.push("repair"); });

  const first = unit({ unit_id: "prepare", command_id: "prepare" });
  const second = unit({ unit_id: "repair", command_id: "repair", dependencies: ["prepare"] });

  await dispatcher.dispatch({ execution_units: [second, first] }, {
    tenantId: "tenant-1",
    simulationApproved: true,
    governanceApproved: true,
    provenanceVerified: true,
    quotaAvailable: true,
  });

  assert.deepEqual(order, ["prepare", "repair"]);
});

test("rejects an unresolved dependency graph", async () => {
  const dispatcher = new PasorExecutionDispatcher();
  dispatcher.register("runtime.restart", async () => undefined);

  await assert.rejects(
    () => dispatcher.dispatch({ execution_units: [unit({ dependencies: ["missing"] })] }, {
      tenantId: "tenant-1",
      simulationApproved: true,
      governanceApproved: true,
      provenanceVerified: true,
      quotaAvailable: true,
    }),
    /EXECUTION_DEPENDENCY_CYCLE/,
  );
});
