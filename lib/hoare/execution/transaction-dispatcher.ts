import { mqttClient, type MqttClientInterface } from "@/lib/mqtt";
import type { AutonomousEvent } from "@/lib/events/event-types";
import { streamProcessor, type EventHandler } from "@/lib/events/stream-processor";
import { ExecutionTransactionCoordinator } from "./transaction-coordinator";
import { buildExecutionDispatchEnvelope } from "./dispatch-envelope";
import type { ExecutionTransactionEventPayload } from "./transaction-events";
import type { ExecutionTransactionRepository } from "./transaction-repository";
import { RedisExecutionTransactionRepository } from "./redis-transaction-repository";

const DISPATCH_TOPIC_ENV = "HOARE_EXECUTION_DISPATCH_TOPIC";

type ExecutionTransactionEvent = AutonomousEvent<ExecutionTransactionEventPayload>;

/**
 * Bridges durable HOARE transaction events to the existing MQTT transport.
 * MQTT carries the execution claims; HYDRA-EDGE admission remains authoritative.
 */
export class ExecutionTransactionDispatcher {
  private registered = false;

  constructor(
    private readonly repository: ExecutionTransactionRepository = new RedisExecutionTransactionRepository(),
    private readonly client: MqttClientInterface = mqttClient,
    private readonly topic = process.env[DISPATCH_TOPIC_ENV],
  ) {}

  register(): void {
    if (this.registered) return;
    if (!this.topic) throw new Error("missing_execution_dispatch_topic");

    streamProcessor.register("execution-transaction-authorized", this.authorizedHandler());
    streamProcessor.register("execution-transaction-retry-requested", this.retryHandler());
    this.registered = true;
  }

  private authorizedHandler(): EventHandler {
    return async (event) => this.dispatch(event as ExecutionTransactionEvent, "AUTHORIZED");
  }

  private retryHandler(): EventHandler {
    return async (event) => {
      const transaction = await this.repository.get(event.payload.transactionId);
      if (!transaction) throw new Error("execution_transaction_not_found");
      if (transaction.attemptId !== event.payload.attemptId) {
        throw new Error("stale_execution_transaction_event");
      }

      // A retry event represents a new attempt waiting for authorization.
      // Re-enter the canonical state machine instead of bypassing it.
      if (transaction.state === "RETRY_PENDING") {
        const coordinator = new ExecutionTransactionCoordinator(this.repository);
        await coordinator.transition(transaction.transactionId, "AUTHORIZED");
      }
    };
  }

  private async dispatch(event: ExecutionTransactionEvent, expectedState: "AUTHORIZED"): Promise<void> {
    const transaction = await this.repository.get(event.payload.transactionId);
    if (!transaction) throw new Error("execution_transaction_not_found");
    if (transaction.attemptId !== event.payload.attemptId || transaction.attemptNumber !== event.payload.attemptNumber) {
      throw new Error("stale_execution_transaction_event");
    }
    if (transaction.state !== expectedState) {
      // Redis redelivery is expected. A transaction already beyond this point
      // must not result in another execution command.
      if (transaction.state === "DISPATCHED" || transaction.state === "ADMITTED" || transaction.state === "RUNNING" || transaction.state === "SUCCEEDED") return;
      throw new Error(`execution_transaction_not_dispatchable:${transaction.state}`);
    }

    if (this.client.getConnectionState() !== "connected") {
      throw new Error("execution_dispatch_transport_unavailable");
    }

    const envelope = buildExecutionDispatchEnvelope(transaction);
    this.client.publish(this.topic, JSON.stringify(envelope), { qos: 1 });

    const coordinator = new ExecutionTransactionCoordinator(this.repository);
    await coordinator.transition(transaction.transactionId, "DISPATCHED");
  }
}

export const executionTransactionDispatcher = new ExecutionTransactionDispatcher();
