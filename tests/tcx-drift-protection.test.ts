import test from "node:test";
import assert from "node:assert/strict";
import { evaluateTcxDrift } from "../lib/hoare/execution/tcx-drift-protection";
import type { ExecutionTransaction } from "../lib/hoare/execution/transaction";

function tx(overrides: Partial<ExecutionTransaction> = {}): ExecutionTransaction {
  return {
    transactionId: "tx-1",
    attemptId: "attempt-1",
    attemptNumber: 1,
    idempotencyKey: "tx-1:attempt:1",
    state: "RUNNING",
    stateVersion: 7,
    tenantId: "tenant-1",
    projectId: "project-1",
    workloadId: "workload-1",
    agentId: "agent-1",
    nodeId: "node-1",
    packId: "pack-1",
    runtimeKind: "python",
    releaseDigest: "release-1",
    artifactDigest: "artifact-1",
    artifactRef: "artifact://1",
    pasorPlanHash: "plan-1",
    pasorUnitId: "unit-1",
    channelId: "channel-1",
    leaseId: "lease-1",
    preconditionHash: "pre-1",
    deadline: "2026-09-03T16:10:00.000Z",
    createdAt: "2026-09-03T15:00:00.000Z",
    updatedAt: "2026-09-03T16:00:00.000Z",
    ...overrides,
  } as ExecutionTransaction;
}

test("no drift permits continuation", () => {
  const result = evaluateTcxDrift(tx(), tx(), {}, new Date("2026-09-03T16:01:00.000Z"));
  assert.equal(result.drifted, false);
  assert.equal(result.action, "CONTINUE");
});

test("state version drift fences and requests replanning", () => {
  const result = evaluateTcxDrift(tx(), tx({ stateVersion: 8 }), {}, new Date("2026-09-03T16:01:00.000Z"));
  assert.equal(result.drifted, true);
  assert.equal(result.action, "FENCE_AND_REPLAN");
  assert.equal(result.observations[0]?.kind, "STATE");
});

test("artifact drift is detected", () => {
  const result = evaluateTcxDrift(tx(), tx({ artifactDigest: "artifact-2" }), {}, new Date("2026-09-03T16:01:00.000Z"));
  assert.equal(result.drifted, true);
  assert.equal(result.observations.some((o) => o.kind === "DEPENDENCY"), true);
});

test("precondition context drift is detected", () => {
  const result = evaluateTcxDrift(tx(), tx({ preconditionHash: "pre-2" }), {}, new Date("2026-09-03T16:01:00.000Z"));
  assert.equal(result.drifted, true);
  assert.equal(result.observations.some((o) => o.kind === "CONTEXT"), true);
});

test("expired deadline is detected", () => {
  const result = evaluateTcxDrift(tx({ deadline: "2026-09-03T15:59:00.000Z" }), tx({ deadline: "2026-09-03T15:59:00.000Z" }), {}, new Date("2026-09-03T16:01:00.000Z"));
  assert.equal(result.drifted, true);
  assert.equal(result.observations.some((o) => o.kind === "TEMPORAL"), true);
});

test("policy can select fence-only recovery", () => {
  const result = evaluateTcxDrift(tx(), tx({ stateVersion: 8 }), { onDrift: "FENCE" }, new Date("2026-09-03T16:01:00.000Z"));
  assert.equal(result.action, "FENCE");
});

test("foundational fences remain enabled by default", () => {
  const result = evaluateTcxDrift(tx(), tx({ artifactDigest: "artifact-2", preconditionHash: "pre-2" }), {}, new Date("2026-09-03T16:01:00.000Z"));
  assert.equal(result.drifted, true);
  assert.equal(result.observations.length, 2);
});
