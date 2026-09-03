import { mqttClient, type MqttClientInterface } from "@/lib/mqtt";
import { parseExecutionEvidenceEnvelope } from "./evidence-envelope";
import { ExecutionEvidenceReconciler } from "./evidence-reconciler";
import type { ExecutionTransactionRepository } from "./transaction-repository";

/**
 * Binds the existing MQTT client to the existing execution evidence
 * reconciler. The topic is deployment configuration, not a new protocol.
 */
export class ExecutionEvidenceTransport {
  private unsubscribe: (() => void) | null = null;
  private removeHandler: (() => void) | null = null;

  constructor(
    private readonly repository: ExecutionTransactionRepository,
    private readonly client: MqttClientInterface = mqttClient,
    private readonly topic = process.env.HOARE_EXECUTION_EVIDENCE_TOPIC,
  ) {}

  start(): void {
    if (!this.topic) throw new Error("missing_execution_evidence_topic");
    if (this.unsubscribe || this.removeHandler) return;

    this.unsubscribe = this.client.subscribe(this.topic, { qos: 1 });
    const reconciler = new ExecutionEvidenceReconciler(this.repository);

    const handler = async (receivedTopic: string, message: string) => {
      if (receivedTopic !== this.topic) return;
      try {
        const envelope = parseExecutionEvidenceEnvelope(JSON.parse(message));
        await reconciler.reconcile(envelope);
      } catch (error) {
        console.error("[HOARE] execution evidence reconciliation failed", error);
      }
    };

    this.removeHandler = this.client.on(handler);
    this.client.connect();
  }

  stop(): void {
    this.removeHandler?.();
    this.removeHandler = null;
    this.unsubscribe?.();
    this.unsubscribe = null;
  }
}
