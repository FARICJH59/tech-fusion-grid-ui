import test from "node:test";
import assert from "node:assert/strict";
import { createExecutionTransaction } from "../lib/hoare/execution/transaction";
import { InMemoryExecutionTransactionRepository } from "../lib/hoare/execution/transaction-repository";

test("startWithAuthority atomically moves ADMITTED to RUNNING only with complete authority", async () => {
  const repository = new InMemoryExecutionTransactionRepository();
  const tx = createExecutionTransaction({
    transactionId: "tx-start-authority",
    tenantId: "tenant-1",
    projectId: "project-1",
    releaseDigest: "release",
    artifactDigest: "artifact",
    artifactRef: "artifact://1",
    pasorPlanHash: "plan",
    pasorUnitId: "unit",
    workloadId: "workload",
    agentId: "agent",
    nodeId: "node",
    packId: "pack",
    runtimeKind: "python",
  });
  await repository.create(tx);
  const authorized = await repository.authorizeWithAuthority(tx.transactionId, tx.attemptId, "decision-1", "proof-1", tx.stateVersion);
  const dispatched = await repository.transition(tx.transactionId, "AUTHORIZED", "DISPATCHED", authorized.stateVersion);
  const admitted = await repository.transition(tx.transactionId, "DISPATCHED", "ADMITTED", dispatched.stateVersion);

  const running = await repository.startWithAuthority(tx.transactionId, tx.attemptId, admitted.stateVersion);

  assert.equal(running.state, "RUNNING");
  assert.equal(running.authorizationDecisionId, "decision-1");
  assert.equal(running.verificationProofId, "proof-1");
  assert.equal(running.stateVersion, admitted.stateVersion + 1);
});

test("startWithAuthority fails closed when AEGIS authority binding is incomplete", async () => {
  const repository = new InMemoryExecutionTransactionRepository();
  const tx = createExecutionTransaction({
    transactionId: "tx-start-no-authority",
    tenantId: "tenant-1",
    projectId: "project-1",
    releaseDigest: "release",
    artifactDigest: "artifact",
    artifactRef: "artifact://1",
    pasorPlanHash: "plan",
    pasorUnitId: "unit",
    workloadId: "workload",
    agentId: "agent",
    nodeId: "node",
    packId: "pack",
    runtimeKind: "python",
  });
  await repository.create(tx);
  const authorized = await repository.authorizeWithAuthority(tx.transactionId, tx.attemptId, "decision-1", "proof-1", tx.stateVersion);
  const dispatched = await repository.transition(tx.transactionId, "AUTHORIZED", "DISPATCHED", authorized.stateVersion);
  const admitted = await repository.transition(tx.transactionId, "DISPATCHED", "ADMITTED", dispatched.stateVersion);
  const tampered = { ...admitted, authorizationDecisionId: undefined, verificationProofId: undefined };
  await repository.update(tampered, admitted.stateVersion);
  const current = await repository.get(tx.transactionId);
  assert.ok(current);

  await assert.rejects(
    repository.startWithAuthority(tx.transactionId, tx.attemptId, current.stateVersion),
    /tcx_execution_requires_fresh_authority_binding/,
  );
  assert.equal((await repository.get(tx.transactionId))?.state, "ADMITTED");
});

test("startWithAuthority rejects stale state version and wrong attempt", async () => {
  const repository = new InMemoryExecutionTransactionRepository();
  const tx = createExecutionTransaction({
    transactionId: "tx-start-cas",
    tenantId: "tenant-1",
    projectId: "project-1",
    releaseDigest: "release",
    artifactDigest: "artifact",
    artifactRef: "artifact://1",
    pasorPlanHash: "plan",
    pasorUnitId: "unit",
    workloadId: "workload",
    agentId: "agent",
    nodeId: "node",
    packId: "pack",
    runtimeKind: "python",
  });
  await repository.create(tx);
  const authorized = await repository.authorizeWithAuthority(tx.transactionId, tx.attemptId, "decision-1", "proof-1", tx.stateVersion);
  const dispatched = await repository.transition(tx.transactionId, "AUTHORIZED", "DISPATCHED", authorized.stateVersion);
  const admitted = await repository.transition(tx.transactionId, "DISPATCHED", "ADMITTED", dispatched.stateVersion);

  await assert.rejects(repository.startWithAuthority(tx.transactionId, "wrong-attempt", admitted.stateVersion), /execution_transaction_attempt_conflict/);
  await assert.rejects(repository.startWithAuthority(tx.transactionId, tx.attemptId, admitted.stateVersion - 1), /execution_transaction_version_conflict/);
  assert.equal((await repository.get(tx.transactionId))?.state, "ADMITTED");
});
