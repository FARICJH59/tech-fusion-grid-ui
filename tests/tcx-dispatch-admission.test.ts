import test from "node:test";
import assert from "node:assert/strict";
import { buildExecutionDispatchEnvelope } from "../lib/hoare/execution/dispatch-envelope";
import { admitTcxDispatch } from "../lib/hoare/execution/tcx-dispatch-admission";
import {
  InMemoryTcxDispatchIntentRepository,
  InMemoryTcxLeaseRepository,
  buildTcxDispatchKey,
} from "../lib/hoare/execution/tcx-dispatch-governance";
import {
  InMemoryExecutionTransactionRepository,
} from "../lib/hoare/execution/transaction-repository";
import { createExecutionTransaction } from "../lib/hoare/execution/transaction";
import type { ExecutionTransaction } from "../lib/hoare/execution/transaction";

const NOW = new Date("2026-09-03T16:00:00.000Z");

function makeTransaction(): ExecutionTransaction {
  return createExecutionTransaction({
    transactionId: "tx-admission-1",
    tenantId: "tenant-1",
    projectId: "project-1",
    releaseDigest: "sha256:release",
    artifactDigest: "sha256:artifact",
    artifactRef: "artifact://one",
    pasorPlanHash: "sha256:plan",
    pasorUnitId: "unit-1",
    workloadId: "workload-1",
    agentId: "agent-1",
    nodeId: "node-1",
    packId: "pack-1",
    runtimeKind: "python",
    channelId: "channel-1",
    leaseId: "lease-1",
  });
}

async function setup() {
  const transactions = new InMemoryExecutionTransactionRepository();
  const dispatchIntents = new InMemoryTcxDispatchIntentRepository();
  const leases = new InMemoryTcxLeaseRepository();
  const transaction = makeTransaction();
  await transactions.create(transaction);
  const authorized = await transactions.transition(transaction.transactionId, "CREATED", "AUTHORIZED", 1);
  const envelope = buildExecutionDispatchEnvelope(authorized, NOW.toISOString());
  const dispatched = await transactions.transition(transaction.transactionId, "AUTHORIZED", "DISPATCHED", authorized.stateVersion);
  await leases.put({
    leaseId: "lease-1",
    transactionId: transaction.transactionId,
    attemptId: transaction.attemptId,
    holderId: "edge-1",
    issuedAt: "2026-09-03T15:59:00.000Z",
    expiresAt: "2026-09-03T16:05:00.000Z",
  });
  const dispatchKey = buildTcxDispatchKey(transaction.transactionId, transaction.attemptId);
  await dispatchIntents.create({
    dispatchKey,
    transactionId: transaction.transactionId,
    attemptId: transaction.attemptId,
    attemptNumber: transaction.attemptNumber,
    stateVersion: authorized.stateVersion,
    idempotencyKey: transaction.idempotencyKey,
    channelId: transaction.channelId,
    status: "PENDING",
    createdAt: NOW.toISOString(),
  });
  await dispatchIntents.claim(dispatchKey, NOW.toISOString());
  return { transactions, dispatchIntents, leases, transaction, envelope, dispatched, dispatchKey };
}

test("TCX admission accepts a valid claimed dispatch and atomically admits it", async () => {
  const ctx = await setup();
  const result = await admitTcxDispatch(ctx.envelope, ctx, NOW);
  assert.equal(result.duplicate, false);
  assert.equal(result.transaction.state, "ADMITTED");
  assert.equal(result.transaction.stateVersion, ctx.dispatched.stateVersion + 1);
});

test("TCX admission accepts a published dispatch intent", async () => {
  const ctx = await setup();
  await ctx.dispatchIntents.markPublished(ctx.dispatchKey, NOW.toISOString());
  const result = await admitTcxDispatch(ctx.envelope, ctx, NOW);
  assert.equal(result.transaction.state, "ADMITTED");
});

test("TCX admission rejects an unclaimed dispatch intent", async () => {
  const ctx = await setup();
  const fresh = await new InMemoryTcxDispatchIntentRepository().create({
    dispatchKey: ctx.dispatchKey,
    transactionId: ctx.transaction.transactionId,
    attemptId: ctx.transaction.attemptId,
    attemptNumber: ctx.transaction.attemptNumber,
    stateVersion: ctx.envelope.stateVersion,
    idempotencyKey: ctx.transaction.idempotencyKey,
    status: "PENDING",
    createdAt: NOW.toISOString(),
  });
  void fresh;
  const dispatchIntents = new InMemoryTcxDispatchIntentRepository();
  await dispatchIntents.create({
    dispatchKey: ctx.dispatchKey,
    transactionId: ctx.transaction.transactionId,
    attemptId: ctx.transaction.attemptId,
    attemptNumber: ctx.transaction.attemptNumber,
    stateVersion: ctx.envelope.stateVersion,
    idempotencyKey: ctx.transaction.idempotencyKey,
    status: "PENDING",
    createdAt: NOW.toISOString(),
  });
  await assert.rejects(
    admitTcxDispatch(ctx.envelope, { ...ctx, dispatchIntents }, NOW),
    /tcx_dispatch_intent_not_claimed/,
  );
});

test("TCX admission rejects cross-attempt identity", async () => {
  const ctx = await setup();
  const envelope = { ...ctx.envelope, attemptId: "other-attempt" };
  await assert.rejects(
    admitTcxDispatch(envelope, ctx, NOW),
    /tcx_dispatch_attempt_id_mismatch/,
  );
});

test("TCX admission rejects idempotency identity mismatch", async () => {
  const ctx = await setup();
  const envelope = { ...ctx.envelope, idempotencyKey: "transaction:wrong:attempt:wrong" };
  await assert.rejects(
    admitTcxDispatch(envelope, ctx, NOW),
    /tcx_dispatch_idempotency_key_mismatch/,
  );
});

test("TCX admission rejects stale envelope state version", async () => {
  const ctx = await setup();
  const envelope = { ...ctx.envelope, stateVersion: ctx.envelope.stateVersion + 1 };
  await assert.rejects(
    admitTcxDispatch(envelope, ctx, NOW),
    /tcx_dispatch_intent_state_version_mismatch/,
  );
});

test("TCX admission rejects an expired lease", async () => {
  const ctx = await setup();
  await ctx.leases.revoke("lease-1", "2026-09-03T15:59:30.000Z");
  await assert.rejects(
    admitTcxDispatch(ctx.envelope, ctx, NOW),
    /tcx_lease_revoked/,
  );
});

test("TCX admission fences an intervening transaction mutation", async () => {
  const ctx = await setup();
  const current = await ctx.transactions.get(ctx.transaction.transactionId);
  assert.ok(current);
  await ctx.transactions.update({ ...current, preconditionHash: "changed-after-dispatch" }, current.stateVersion);
  await assert.rejects(
    admitTcxDispatch(ctx.envelope, ctx, NOW),
    /tcx_dispatch_state_version_mismatch/,
  );
});

test("TCX admission makes duplicate delivery a no-op after admission", async () => {
  const ctx = await setup();
  const first = await admitTcxDispatch(ctx.envelope, ctx, NOW);
  const second = await admitTcxDispatch(ctx.envelope, ctx, NOW);
  assert.equal(first.transaction.state, "ADMITTED");
  assert.equal(second.duplicate, true);
  assert.equal(second.transaction.stateVersion, first.transaction.stateVersion);
});

test("TCX admission fences expired lease before execution can be admitted", async () => {
  const ctx = await setup();
  await ctx.leases.revoke("lease-1", "2026-09-03T16:00:00.000Z");
  const before = await ctx.transactions.get(ctx.transaction.transactionId);
  await assert.rejects(admitTcxDispatch(ctx.envelope, ctx, NOW), /tcx_lease_revoked/);
  const after = await ctx.transactions.get(ctx.transaction.transactionId);
  assert.equal(after?.state, before?.state);
  assert.equal(after?.stateVersion, before?.stateVersion);
});
