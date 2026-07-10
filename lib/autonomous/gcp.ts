/**
 * GCPOperations — type-safe GCP integration layer for project caramel-limiter-495010-b9.
 * All implementations are in-memory mocks; no real GCP SDK calls are made.
 */

import { randomUUID } from "node:crypto";
import { jobScheduler } from "./scheduler";

export const GCP_PROJECT = "caramel-limiter-495010-b9";
export const GCP_REGION = process.env.GCP_REGION ?? "us-central1";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type CloudRunService = {
  name: string;
  region: string;
  url?: string;
  status: "running" | "stopped" | "deploying";
  revision?: string;
};

export type PubSubMessage = {
  messageId: string;
  data: string;
  attributes?: Record<string, string>;
  publishTime: string;
};

export type SecretRef = {
  name: string;
  version?: string;
};

export type CloudMonitoringDescriptor = {
  name: string;
  metricKind: "GAUGE" | "DELTA" | "CUMULATIVE";
  valueType: "INT64" | "DOUBLE" | "BOOL" | "STRING";
  description: string;
};

export type WorkloadIdentityConfig = {
  serviceAccount: string;
  provider: string;
  audience: string;
};

// ---------------------------------------------------------------------------
// GCPOperations class
// ---------------------------------------------------------------------------

export class GCPOperations {
  readonly projectId = GCP_PROJECT;

  private readonly cloudRunServices = new Map<string, CloudRunService>();
  private readonly pubSubHandlers = new Map<string, Set<(msg: PubSubMessage) => void>>();
  private readonly pubSubMessages = new Map<string, PubSubMessage[]>();

  // ── Cloud Run ──────────────────────────────────────────────────────────────

  listCloudRunServices(): CloudRunService[] {
    return [...this.cloudRunServices.values()];
  }

  registerCloudRunService(svc: CloudRunService): void {
    this.cloudRunServices.set(svc.name, svc);
  }

  // ── Pub/Sub (in-memory mock) ───────────────────────────────────────────────

  publish(
    topic: string,
    data: unknown,
    attributes?: Record<string, string>,
  ): PubSubMessage {
    const msg: PubSubMessage = {
      messageId: randomUUID(),
      data: typeof data === "string" ? data : JSON.stringify(data),
      attributes,
      publishTime: new Date().toISOString(),
    };

    const existing = this.pubSubMessages.get(topic) ?? [];
    existing.push(msg);
    this.pubSubMessages.set(topic, existing);

    const handlers = this.pubSubHandlers.get(topic);
    if (handlers) {
      for (const handler of handlers) {
        try { handler(msg); } catch { /* swallow */ }
      }
    }

    return msg;
  }

  /** Subscribe to a topic; returns an unsubscribe function. */
  subscribe(topic: string, handler: (msg: PubSubMessage) => void): () => void {
    const handlers = this.pubSubHandlers.get(topic) ?? new Set();
    handlers.add(handler);
    this.pubSubHandlers.set(topic, handlers);
    return () => {
      handlers.delete(handler);
      if (handlers.size === 0) this.pubSubHandlers.delete(topic);
    };
  }

  // ── Secret Manager (env-backed mock) ─────────────────────────────────────

  getSecret(ref: SecretRef): string | undefined {
    const envKey = ref.name
      .toUpperCase()
      .replace(/-/g, "_")
      .replace(/\//g, "_");
    return process.env[envKey];
  }

  // ── Workload Identity Federation ──────────────────────────────────────────

  getWorkloadIdentityConfig(): WorkloadIdentityConfig | null {
    const sa = process.env.GCP_SERVICE_ACCOUNT;
    const provider = process.env.GCP_WORKLOAD_IDENTITY_PROVIDER;
    if (!sa || !provider) return null;
    return {
      serviceAccount: sa,
      provider,
      audience: `//iam.googleapis.com/${provider}`,
    };
  }

  // ── Cloud Logging ─────────────────────────────────────────────────────────

  structuredLog(
    severity: "DEFAULT" | "INFO" | "WARNING" | "ERROR" | "CRITICAL",
    message: string,
    labels?: Record<string, string>,
  ): void {
    const entry = JSON.stringify({
      severity,
      message,
      "logging.googleapis.com/labels": labels ?? {},
      timestamp: new Date().toISOString(),
      resource: {
        type: "cloud_run_revision",
        labels: { project_id: this.projectId, location: GCP_REGION },
      },
    });
    if (severity === "ERROR" || severity === "CRITICAL") {
      console.error(entry);
    } else {
      console.log(entry);
    }
  }

  // ── Cloud Monitoring ──────────────────────────────────────────────────────

  getMetricDescriptors(): CloudMonitoringDescriptor[] {
    return [
      {
        name: `custom.googleapis.com/${GCP_PROJECT}/agent_executions`,
        metricKind: "CUMULATIVE",
        valueType: "INT64",
        description: "Total agent executions",
      },
      {
        name: `custom.googleapis.com/${GCP_PROJECT}/active_tenants`,
        metricKind: "GAUGE",
        valueType: "INT64",
        description: "Number of active tenants",
      },
      {
        name: `custom.googleapis.com/${GCP_PROJECT}/cost_micro_usd`,
        metricKind: "DELTA",
        valueType: "INT64",
        description: "Cost in micro-USD",
      },
    ];
  }

  // ── Cloud Scheduler integration ──────────────────────────────────────────

  registerCloudSchedulerJob(
    name: string,
    intervalMs: number,
    handler: () => Promise<void>,
  ): void {
    jobScheduler.register({
      id: `gcp-scheduler:${name}`,
      name,
      schedule: `every ${intervalMs}ms`,
      handler,
      intervalMs,
    });
  }
}

export const gcpOperations = new GCPOperations();
