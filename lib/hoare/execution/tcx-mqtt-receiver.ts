import { mqttClient } from "@/lib/mqtt";
import type { ExecutionDispatchEnvelope } from "./dispatch-envelope";
import { parseExecutionDispatchEnvelope } from "./dispatch-envelope";
import { ExecutionTransactionCoordinator } from "./transaction-coordinator";
import type { ExecutionTransactionRepository } from "./transaction-repository";
import { RedisExecutionTransactionRepository } from "./redis-transaction-repository";
import {
  RedisTcxDispatchIntentRepository,
  RedisTcxLeaseRepository,
  type TcxDispatchIntentRepository,
  type TcxLeaseRepository,
} from "./tcx-dispatch-governance";
import {
  admitTcxDispatch,
  type TcxDispatchAdmissionDependencies,
} from "./tcx-dispatch-admission";

const DISPATCH_TOPIC_ENV = "HOARE_EXECUTION_DISPATCH_TOPIC";

type MqttReceiverClient = {
  subscribe(topic: string, options?: { qos?: 0 | 1 | 2 }): () => void;
  on(handler: (topic: string, message: string) => void): () => void;
};

export type TcxExecutionHandler = (
  transaction: Awaited<ReturnType<ExecutionTransactionRepository["get"]>> extends infer T
    ? Exclude<T, null | undefined>
    : never,
  envelope: ExecutionDispatchEnvelope,
) => Promise<void>;

export type TcxMqttReceiverOptions = {
  repository?: ExecutionTransactionRepository;
  leases?: TcxLeaseRepository;
  dispatchIntents?: TcxDispatchIntentRepository;
  client?: MqttReceiverClient;
  topic?: string;
  execute: TcxExecutionHandler;
  onRejected?: (error: unknown, topic: string, rawMessage: string) => void;
};

/**
 * Production receiver boundary for TCX execution dispatches.
 *
 * MQTT delivery is untrusted input. Nothing reaches the execution handler
 * until envelope parsing, transaction identity, dispatch-intent state,
 * lease fencing, and state-version admission have all succeeded.
 *
 * The receiver advances DISPATCHED -> ADMITTED -> RUNNING before invoking the
 * executor. Therefore a replayed MQTT message cannot invoke the executor a
 * second time after admission. Successful execution is deliberately not
 * finalized here; evidence must cross tcx-commit-finalizer instead.
 */
export class TcxMqttExecutionReceiver {
  private registered = false;
  private readonly repository: ExecutionTransactionRepository;
  private readonly leases: TcxLeaseRepository;
  private readonly dispatchIntents: TcxDispatchIntentRepository;
  private readonly client: MqttReceiverClient;
  private readonly topic?: string;
  private readonly execute: TcxExecutionHandler;
  private readonly onRejected?: TcxMqttReceiverOptions["onRejected"];

  constructor(options: TcxMqttReceiverOptions) {
    this.repository = options.repository ?? new RedisExecutionTransactionRepository();
    this.leases = options.leases ?? new RedisTcxLeaseRepository();
    this.dispatchIntents = options.dispatchIntents ?? new RedisTcxDispatchIntentRepository();
    this.client = options.client ?? mqttClient;
    this.topic = options.topic ?? process.env[DISPATCH_TOPIC_ENV];
    this.execute = options.execute;
    this.onRejected = options.onRejected;
  }

  register(): () => void {
    if (this.registered) return () => undefined;
    if (!this.topic) throw new Error("missing_execution_dispatch_topic");

    const unsubscribe = this.client.subscribe(this.topic, { qos: 1 });
    const off = this.client.on((topic, message) => {
      void this.handleMessage(topic, message);
    });
    this.registered = true;

    return () => {
      off();
      unsubscribe();
      this.registered = false;
    };
  }

  private async handleMessage(topic: string, rawMessage: string): Promise<void> {
    if (topic !== this.topic) return;

    try {
      const envelope = parseExecutionDispatchEnvelope(JSON.parse(rawMessage));
      const dependencies: TcxDispatchAdmissionDependencies = {
        transactions: this.repository,
        leases: this.leases,
        dispatchIntents: this.dispatchIntents,
      };

      const admission = await admitTcxDispatch(envelope, dependencies);
      if (admission.duplicate) return;

      const coordinator = new ExecutionTransactionCoordinator(this.repository);
      const running = await coordinator.transition(admission.transaction.transactionId, "RUNNING");

      // The transaction is RUNNING before any executor call. This is the
      // durable execution fence that makes MQTT replay non-reentrant.
      await this.execute(running, envelope);
    } catch (error) {
      this.onRejected?.(error, topic, rawMessage);
    }
  }
}

export const createTcxMqttExecutionReceiver = (
  options: TcxMqttReceiverOptions,
): TcxMqttExecutionReceiver => new TcxMqttExecutionReceiver(options);
