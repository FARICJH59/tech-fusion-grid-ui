import test from "node:test";
import assert from "node:assert/strict";
import { createExecutionTransaction } from "../lib/hoare/execution/transaction";
import { InMemoryExecutionTransactionRepository } from "../lib/hoare/execution/transaction-repository";
import { InMemoryTcxDispatchIntentRepository, InMemoryTcxLeaseRepository, buildTcxDispatchKey } from "../lib/hoare/execution/tcx-dispatch-governance";
import { buildExecutionDispatchEnvelope } from "../lib/hoare/execution/dispatch-envelope";
import { InMemoryTcxExecutionFenceController } from "../lib/hoare/execution/tcx-execution-fence";
import { TcxMqttExecutionReceiver, type TcxExecutionContext } from "../lib/hoare/execution/tcx-mqtt-receiver";

class FakeMqtt {
  handler?: (topic: string, message: string) => void | Promise<void>;
  subscribe(): () => void { return () => undefined; }
  on(handler: (topic: string, message: string) => void | Promise<void>): () => void { this.handler = handler; return () => undefined; }
  async deliver(topic: string, envelope: unknown): Promise<void> {
    assert.ok(this.handler);
    await this.handler(topic, JSON.stringify(envelope));
  }
}

test("TCX receiver supplies a live fenced execution context only after RUNNING admission", async () => {
  const repository = new InMemoryExecutionTransactionRepository();
  const leases = new InMemoryTcxLeaseRepository();
  const dispatchIntents = new InMemoryTcxDispatchIntentRepository();
  const fences = new InMemoryTcxExecutionFenceController();
  const client = new FakeMqtt();
  const transactionId = `tx-governed-${Date.now()}`;
  const tx = createExecutionTransaction({
    transactionId, tenantId: "tenant-1", projectId: "project-1",
    releaseDigest: "release-1", artifactDigest: "artifact-1", artifactRef: "artifact://1",
    pasorPlanHash: "plan-1", pasorUnitId: "unit-1", workloadId: "workload-1",
    agentId: "agent-1", nodeId: "node-1", packId: "pack-1", runtimeKind: "python",
    channelId: "channel-1", leaseId: "lease-1",
  });
  await repository.create(tx);
  const current = await repository.transition(tx.transactionId, "CREATED", "AUTHORIZED", tx.stateVersion);
  const envelope = buildExecutionDispatchEnvelope(current);
  await repository.transition(tx.transactionId, "AUTHORIZED", "DISPATCHED", current.stateVersion);
  await leases.put({ leaseId: "lease-1", transactionId: tx.transactionId, attemptId: tx.attemptId, holderId: tx.nodeId, issuedAt: new Date(Date.now() - 1_000).toISOString(), expiresAt: new Date(Date.now() + 60_000).toISOString() });
  await dispatchIntents.create({ dispatchKey: buildTcxDispatchKey(tx.transactionId, tx.attemptId), transactionId: tx.transactionId, attemptId: tx.attemptId, attemptNumber: tx.attemptNumber, stateVersion: envelope.stateVersion, idempotencyKey: envelope.idempotencyKey, channelId: tx.channelId, status: "CLAIMED", createdAt: new Date().toISOString() });

  let received: TcxExecutionContext | undefined;
  const receiver = new TcxMqttExecutionReceiver({
    repository, leases, dispatchIntents, fenceController: fences, client,
    topic: "hoare/execution/dispatch",
    executeGoverned: async (running, admittedEnvelope, tcxExecution) => {
      assert.equal(running.state, "RUNNING");
      assert.equal(admittedEnvelope.transactionId, tx.transactionId);
      received = tcxExecution;
      await tcxExecution.fenceController.assertActive(tcxExecution.transactionId, tcxExecution.attemptId);
    },
  });
  receiver.register();
  await client.deliver("hoare/execution/dispatch", envelope);

  assert.equal(received?.transactionId, tx.transactionId);
  assert.equal(received?.attemptId, tx.attemptId);
  assert.ok(received?.fenceController);
  const final = await repository.get(tx.transactionId);
  assert.equal(final?.state, "RUNNING");
});
