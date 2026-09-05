import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  createExecutionTransaction,
  type ExecutionTransaction,
} from "../lib/hoare/execution/transaction";
import { InMemoryExecutionTransactionRepository } from "../lib/hoare/execution/transaction-repository";
import {
  InMemoryTcxDispatchIntentRepository,
  InMemoryTcxLeaseRepository,
  buildTcxDispatchKey,
  type TcxLease,
} from "../lib/hoare/execution/tcx-dispatch-governance";
import { buildExecutionDispatchEnvelope } from "../lib/hoare/execution/dispatch-envelope";
import { InMemoryTcxExecutionFenceController } from "../lib/hoare/execution/tcx-execution-fence";
import { TcxMqttExecutionReceiver, type TcxExecutionContext } from "../lib/hoare/execution/tcx-mqtt-receiver";

class FakeMqtt {
  handler?: (topic: string, message: string) => void;
  subscribed?: string;

  subscribe(topic: string): () => void {
    this.subscribed = topic;
    return () => {
      this.subscribed = undefined;
    };
  }

  on(handler: (topic: string, message: string) => void): () => void {
    this.handler = handler;
    return () => {
      this.handler = undefined;
    };
  }

  async deliver(topic: string, envelope: unknown): Promise<void> {
    assert.ok(this.handler);
    this.handler(topic, JSON.stringify(envelope));
    await new Promise((resolve) => setImmediate(resolve));
  }
}

function makeTransaction(): ExecutionTransaction {
  return createExecutionTransaction({
    transactionId: "tx-receiver-1",
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

async function authorizeAndDispatch(
  repository: InMemoryExecutionTransactionRepository,
  transaction: ExecutionTransaction,
) {
  let current = await repository.transition(transaction.transactionId, "CREATED", "AUTHORIZED", transaction.stateVersion);
  const envelope = buildExecutionDispatchEnvelope(current);
  current = await repository.transition(transaction.transactionId, "AUTHORIZED", "DISPATCHED", current.stateVersion);
  return { envelope, dispatched: current };
}

async function prepareDispatch(
  repository: InMemoryExecutionTransactionRepository,
  leases: InMemoryTcxLeaseRepository,
  dispatchIntents: InMemoryTcxDispatchIntentRepository,
  transaction: ExecutionTransaction,
) {
  await repository.create(transaction);
  const lease: TcxLease = {
    leaseId: "lease-1",
    transactionId: transaction.transactionId,
    attemptId: transaction.attemptId,
    holderId: transaction.nodeId,
    issuedAt: new Date(Date.now() - 1_000).toISOString(),
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
  };
  await leases.put(lease);
  const { envelope } = await authorizeAndDispatch(repository, transaction);
  const intentKey = buildTcxDispatchKey(transaction.transactionId, transaction.attemptId);
  await dispatchIntents.create({
    dispatchKey: intentKey,
    transactionId: transaction.transactionId,
    attemptId: transaction.attemptId,
    attemptNumber: transaction.attemptNumber,
    stateVersion: envelope.stateVersion,
    idempotencyKey: envelope.idempotencyKey,
    channelId: envelope.channelId,
    status: "CLAIMED",
    createdAt: new Date().toISOString(),
  });
  return envelope;
}

describe("TCX MQTT execution receiver", () => {
  it("admits before governed execution and prevents replay from invoking it twice", async () => {
    const repository = new InMemoryExecutionTransactionRepository();
    const leases = new InMemoryTcxLeaseRepository();
    const dispatchIntents = new InMemoryTcxDispatchIntentRepository();
    const fenceController = new InMemoryTcxExecutionFenceController();
    const client = new FakeMqtt();
    const transaction = makeTransaction();
    const envelope = await prepareDispatch(repository, leases, dispatchIntents, transaction);

    let executions = 0;
    let receivedContext: TcxExecutionContext | undefined;
    const receiver = new TcxMqttExecutionReceiver({
      repository,
      leases,
      dispatchIntents,
      fenceController,
      client,
      topic: "hoare/execution/dispatch",
      executeGoverned: async (running, admittedEnvelope, tcxExecution) => {
        executions += 1;
        receivedContext = tcxExecution;
        assert.equal(running.state, "RUNNING");
        assert.equal(admittedEnvelope.transactionId, running.transactionId);
        await tcxExecution.fenceController.assertActive(tcxExecution.transactionId, tcxExecution.attemptId);
      },
    });
    receiver.register();

    await client.deliver("hoare/execution/dispatch", envelope);
    await client.deliver("hoare/execution/dispatch", envelope);

    const final = await repository.get(transaction.transactionId);
    assert.equal(executions, 1);
    assert.equal(final?.state, "RUNNING");
    assert.equal(final?.attemptId, transaction.attemptId);
    assert.equal(receivedContext?.transactionId, transaction.transactionId);
    assert.equal(receivedContext?.attemptId, transaction.attemptId);
  });

  it("rejects a revoked dispatch before governed execution", async () => {
    const repository = new InMemoryExecutionTransactionRepository();
    const leases = new InMemoryTcxLeaseRepository();
    const dispatchIntents = new InMemoryTcxDispatchIntentRepository();
    const fenceController = new InMemoryTcxExecutionFenceController();
    const client = new FakeMqtt();
    const transaction = makeTransaction();
    const envelope = await prepareDispatch(repository, leases, dispatchIntents, transaction);
    await leases.revoke(transaction.leaseId!);

    let executions = 0;
    const rejected: unknown[] = [];
    const receiver = new TcxMqttExecutionReceiver({
      repository,
      leases,
      dispatchIntents,
      fenceController,
      client,
      topic: "hoare/execution/dispatch",
      executeGoverned: async () => {
        executions += 1;
      },
      onRejected: (error) => rejected.push(error),
    });
    receiver.register();

    await client.deliver("hoare/execution/dispatch", envelope);

    const final = await repository.get(transaction.transactionId);
    assert.equal(executions, 0);
    assert.equal(final?.state, "DISPATCHED");
    assert.equal(rejected.length, 1);
  });
});
