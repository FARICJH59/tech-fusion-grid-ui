import { mqttClient } from "@/lib/mqtt";
import type { AutonomousEvent } from "@/lib/events/event-types";
import { streamProcessor, type EventHandler } from "@/lib/events/stream-processor";
import { ExecutionTransactionCoordinator } from "./transaction-coordinator";
import { buildExecutionDispatchEnvelope } from "./dispatch-envelope";
import type { ExecutionTransactionEventPayload } from "./transaction-events";
import type { ExecutionTransactionRepository } from "./transaction-repository";
import { RedisExecutionTransactionRepository } from "./redis-transaction-repository";
import { buildTcxDispatchKey, requireValidTcxLease, RedisTcxDispatchIntentRepository, RedisTcxLeaseRepository, type TcxDispatchIntentRepository, type TcxLeaseRepository } from "./tcx-dispatch-governance";
const DISPATCH_TOPIC_ENV = "HOARE_EXECUTION_DISPATCH_TOPIC";
type ExecutionTransactionEvent = AutonomousEvent<ExecutionTransactionEventPayload>;
type MqttDispatchClient = { getConnectionState(): "disconnected" | "connecting" | "connected" | "reconnecting"; publish(topic: string, message: string, options?: { qos?: 0 | 1 | 2 }): void };
export class ExecutionTransactionDispatcher {
  private registered = false;
  constructor(private readonly repository: ExecutionTransactionRepository = new RedisExecutionTransactionRepository(), private readonly client: MqttDispatchClient = mqttClient, private readonly topic = process.env[DISPATCH_TOPIC_ENV], private readonly leases: TcxLeaseRepository = new RedisTcxLeaseRepository(), private readonly dispatchIntents: TcxDispatchIntentRepository = new RedisTcxDispatchIntentRepository()) {}
  register(): void { if (this.registered) return; if (!this.topic) throw new Error("missing_execution_dispatch_topic"); streamProcessor.register("execution-transaction-authorized", this.authorizedHandler()); streamProcessor.register("execution-transaction-retry-requested", this.retryHandler()); this.registered = true; }
  private authorizedHandler(): EventHandler { return async (event) => this.dispatch(event as ExecutionTransactionEvent); }
  private retryHandler(): EventHandler { return async (event) => { const typedEvent = event as ExecutionTransactionEvent; const transaction = await this.repository.get(typedEvent.payload.transactionId); if (!transaction) throw new Error("execution_transaction_not_found"); if (transaction.attemptId !== typedEvent.payload.attemptId || transaction.attemptNumber !== typedEvent.payload.attemptNumber) throw new Error("stale_execution_transaction_event"); if (transaction.state !== "RETRY_PENDING") return; await new ExecutionTransactionCoordinator(this.repository).transition(transaction.transactionId, "AUTHORIZED"); }; }
  private async dispatch(event: ExecutionTransactionEvent): Promise<void> {
    const transaction = await this.repository.get(event.payload.transactionId); if (!transaction) throw new Error("execution_transaction_not_found");
    if (transaction.attemptId !== event.payload.attemptId || transaction.attemptNumber !== event.payload.attemptNumber) throw new Error("stale_execution_transaction_event");
    if (transaction.state !== "AUTHORIZED") { if (["DISPATCHED", "ADMITTED", "RUNNING", "SUCCEEDED"].includes(transaction.state)) return; throw new Error(`execution_transaction_not_dispatchable:${transaction.state}`); }
    await requireValidTcxLease(transaction, this.leases);
    const dispatchKey = buildTcxDispatchKey(transaction.transactionId, transaction.attemptId);
    const intent = await this.dispatchIntents.create({ dispatchKey, transactionId: transaction.transactionId, attemptId: transaction.attemptId, attemptNumber: transaction.attemptNumber, stateVersion: transaction.stateVersion, idempotencyKey: transaction.idempotencyKey, channelId: transaction.channelId, status: "PENDING", createdAt: new Date().toISOString() });
    const coordinator = new ExecutionTransactionCoordinator(this.repository);
    if (intent.status === "PUBLISHED") { await coordinator.transition(transaction.transactionId, "DISPATCHED"); return; }
    const claimed = await this.dispatchIntents.claim(dispatchKey); if (claimed.status === "PUBLISHED") { await coordinator.transition(transaction.transactionId, "DISPATCHED"); return; }
    if (claimed.status !== "CLAIMED") throw new Error("tcx_dispatch_intent_claim_failed"); if (this.client.getConnectionState() !== "connected") throw new Error("execution_dispatch_transport_unavailable");
    const topic = this.topic; if (!topic) throw new Error("missing_execution_dispatch_topic");
    this.client.publish(topic, JSON.stringify(buildExecutionDispatchEnvelope(transaction)), { qos: 1 });
    await this.dispatchIntents.markPublished(dispatchKey); await coordinator.transition(transaction.transactionId, "DISPATCHED");
  }
}
export const executionTransactionDispatcher = new ExecutionTransactionDispatcher();
