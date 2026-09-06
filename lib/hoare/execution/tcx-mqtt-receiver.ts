import { mqttClient } from "@/lib/mqtt";
import type { ExecutionDispatchEnvelope } from "./dispatch-envelope";
import { parseExecutionDispatchEnvelope } from "./dispatch-envelope";
import { ExecutionTransactionCoordinator } from "./transaction-coordinator";
import type { ExecutionTransactionRepository } from "./transaction-repository";
import { RedisExecutionTransactionRepository } from "./redis-transaction-repository";
import { RedisTcxDispatchIntentRepository, RedisTcxLeaseRepository, type TcxDispatchIntentRepository, type TcxLeaseRepository } from "./tcx-dispatch-governance";
import { admitTcxDispatch, type TcxDispatchAdmissionDependencies } from "./tcx-dispatch-admission";
import { RedisTcxExecutionFenceController } from "./redis-tcx-execution-fence";
import type { TcxExecutionFenceController } from "./tcx-execution-fence";
import type { GovernedExecutionAuthority } from "../runtime/governed-execution-authority";
import { issueTcxExecutionAuthority } from "../runtime/tcx-authority-factory";

const DISPATCH_TOPIC_ENV = "HOARE_EXECUTION_DISPATCH_TOPIC";

type MqttReceiverClient = {
  subscribe(topic: string, options?: { qos?: 0 | 1 | 2 }): () => void;
  on(handler: (topic: string, message: string) => void | Promise<void>): () => void;
};

export type TcxExecutionContext = Readonly<{
  transactionId: string;
  attemptId: string;
  fenceController: TcxExecutionFenceController;
  /** TCX-issued authority; callers must propagate this object to live-capable runtimes. */
  authority: GovernedExecutionAuthority;
}>;

export type TcxExecutionHandler = (
  transaction: Awaited<ReturnType<ExecutionTransactionRepository["get"]>> extends infer T ? Exclude<T, null | undefined> : never,
  envelope: ExecutionDispatchEnvelope,
  tcxExecution: TcxExecutionContext,
) => Promise<void>;

export type TcxMqttReceiverOptions = {
  repository?: ExecutionTransactionRepository;
  leases?: TcxLeaseRepository;
  dispatchIntents?: TcxDispatchIntentRepository;
  fenceController?: TcxExecutionFenceController;
  client?: MqttReceiverClient;
  topic?: string;
  executeGoverned: TcxExecutionHandler;
  onRejected?: (error: unknown, topic: string, rawMessage: string) => void;
};

/** Production TCX receiver: untrusted MQTT cannot manufacture execution authority. */
export class TcxMqttExecutionReceiver {
  private registered = false;
  private readonly repository: ExecutionTransactionRepository;
  private readonly leases: TcxLeaseRepository;
  private readonly dispatchIntents: TcxDispatchIntentRepository;
  private readonly fenceController: TcxExecutionFenceController;
  private readonly client: MqttReceiverClient;
  private readonly topic?: string;
  private readonly executeGoverned: TcxExecutionHandler;
  private readonly onRejected?: TcxMqttReceiverOptions["onRejected"];

  constructor(options: TcxMqttReceiverOptions) {
    this.repository = options.repository ?? new RedisExecutionTransactionRepository();
    this.leases = options.leases ?? new RedisTcxLeaseRepository();
    this.dispatchIntents = options.dispatchIntents ?? new RedisTcxDispatchIntentRepository();
    this.fenceController = options.fenceController ?? new RedisTcxExecutionFenceController();
    this.client = options.client ?? mqttClient;
    this.topic = options.topic ?? process.env[DISPATCH_TOPIC_ENV];
    this.executeGoverned = options.executeGoverned;
    this.onRejected = options.onRejected;
  }

  register(): () => void {
    if (this.registered) return () => undefined;
    if (!this.topic) throw new Error("missing_execution_dispatch_topic");
    const unsubscribe = this.client.subscribe(this.topic, { qos: 1 });
    const off = this.client.on((topic, message) => this.handleMessage(topic, message));
    this.registered = true;
    return () => { off(); unsubscribe(); this.registered = false; };
  }

  private async handleMessage(topic: string, rawMessage: string): Promise<void> {
    if (topic !== this.topic) return;
    try {
      const envelope = parseExecutionDispatchEnvelope(JSON.parse(rawMessage));
      const dependencies: TcxDispatchAdmissionDependencies = { transactions: this.repository, leases: this.leases, dispatchIntents: this.dispatchIntents };
      const admission = await admitTcxDispatch(envelope, dependencies);
      if (admission.duplicate) return;

      const coordinator = new ExecutionTransactionCoordinator(this.repository);
      const running = await coordinator.transition(admission.transaction.transactionId, "RUNNING");
      await this.fenceController.assertActive(running.transactionId, running.attemptId);

      // Authority is issued from authoritative TCX state after RUNNING transition.
      // The MQTT envelope is deliberately not a source of authorization or proof IDs.
      const authority = await issueTcxExecutionAuthority(running.transactionId, {
        transactions: this.repository,
        leases: this.leases,
        fence: this.fenceController,
      });

      const tcxExecution: TcxExecutionContext = Object.freeze({
        transactionId: running.transactionId,
        attemptId: running.attemptId,
        fenceController: this.fenceController,
        authority,
      });

      await authority.assertValid();
      await this.executeGoverned(running, envelope, tcxExecution);
      await authority.assertValid();
    } catch (error) {
      this.onRejected?.(error, topic, rawMessage);
    }
  }
}

export const createTcxMqttExecutionReceiver = (options: TcxMqttReceiverOptions): TcxMqttExecutionReceiver => new TcxMqttExecutionReceiver(options);
