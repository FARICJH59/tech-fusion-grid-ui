import type {
  DeploymentEvent,
  DeploymentLifecycleState,
  DeploymentRecord,
} from "@/lib/cloud/cloud-types";
import { supabase } from "@/lib/supabase";
import { autonomousEventBus } from "@/lib/events/event-bus";

type DeploymentStore = {
  deployments: DeploymentRecord[];
  history: DeploymentRecord[];
  events: DeploymentEvent[];
  revisions: Record<string, string[]>;
};

export class DeploymentManager {
  private readonly store: DeploymentStore;

  constructor(store?: Partial<DeploymentStore>) {
    this.store = {
      deployments: store?.deployments ?? [],
      history: store?.history ?? [],
      events: store?.events ?? [],
      revisions: store?.revisions ?? {},
    };
  }

  request(input: {
    id: string;
    tenantId: string;
    requestedBy: string;
    service: string;
    region: string;
    targetImage: string;
    previousRevision?: string;
  }): DeploymentRecord {
    const now = new Date().toISOString();
    const record: DeploymentRecord = {
      id: input.id,
      tenantId: input.tenantId,
      requestedBy: input.requestedBy,
      service: input.service,
      region: input.region,
      targetImage: input.targetImage,
      previousRevision: input.previousRevision,
      status: "requested",
      createdAt: now,
      updatedAt: now,
    };

    this.store.deployments.push(record);
    this.store.history.push(record);
    this.appendEvent(record.id, "requested", "Deployment requested");
    void this.persist(record);
    return record;
  }

  transition(deploymentId: string, status: DeploymentLifecycleState, message: string): DeploymentRecord | null {
    const record = this.store.deployments.find((item) => item.id === deploymentId);
    if (!record) return null;

    record.status = status;
    record.updatedAt = new Date().toISOString();
    this.store.history.push({ ...record });
    this.appendEvent(deploymentId, status, message);
    void this.persist(record);

    return record;
  }

  setRevision(deploymentId: string, revision: string): void {
    const record = this.store.deployments.find((item) => item.id === deploymentId);
    if (!record) return;
    record.nextRevision = revision;
    const key = `${record.tenantId}:${record.service}`;
    const revisions = this.store.revisions[key] ?? [];
    this.store.revisions[key] = [...new Set([revision, ...revisions])].slice(0, 10);
    record.updatedAt = new Date().toISOString();
    this.store.history.push({ ...record });
    this.appendEvent(deploymentId, record.status, `Revision set to ${revision}`);
    void this.persist(record);
  }

  get(deploymentId: string): DeploymentRecord | null {
    return this.store.deployments.find((item) => item.id === deploymentId) ?? null;
  }

  list(tenantId: string): DeploymentRecord[] {
    return this.store.deployments.filter((item) => item.tenantId === tenantId);
  }

  listEvents(deploymentId: string): DeploymentEvent[] {
    return this.store.events.filter((event) => event.deploymentId === deploymentId);
  }

  revisionState(tenantId: string, service: string): string[] {
    return this.store.revisions[`${tenantId}:${service}`] ?? [];
  }

  private appendEvent(
    deploymentId: string,
    state: DeploymentLifecycleState,
    message: string,
    metadata?: Record<string, unknown>,
  ): void {
    const event: DeploymentEvent = {
      deploymentId,
      state,
      message,
      metadata,
      timestamp: new Date().toISOString(),
    };
    this.store.events.push(event);
    void this.persistEvent(event);
  }

  private async persist(record: DeploymentRecord): Promise<void> {
    try {
      await supabase.from("deployments").upsert({
        id: record.id,
        tenant_id: record.tenantId,
        organization_id: record.tenantId,
        service: record.service,
        region: record.region,
        status: record.status,
        target_image: record.targetImage,
        previous_revision: record.previousRevision,
        next_revision: record.nextRevision,
        metadata: record,
        updated_at: record.updatedAt,
      });
    } catch {
      // Best-effort persistence in non-configured environments.
    }
  }

  private async persistEvent(event: DeploymentEvent): Promise<void> {
    const deployment = this.get(event.deploymentId);
    if (!deployment) return;

    try {
      await supabase.from("deployment_events").insert({
        id: `${event.deploymentId}:${event.timestamp}:${event.state}`,
        deployment_id: event.deploymentId,
        tenant_id: deployment.tenantId,
        organization_id: deployment.tenantId,
        event_type: event.state,
        message: event.message,
        metadata: event.metadata ?? {},
        created_at: event.timestamp,
      });
    } catch {
      // Best-effort persistence in non-configured environments.
    }

    await autonomousEventBus.publish({
      id: `${event.deploymentId}:${event.state}:${Date.now().toString(36)}`,
      tenantId: deployment.tenantId,
      organizationId: deployment.tenantId,
      type: "deployment",
      source: "deployment-manager",
      priority: event.state === "rolled-back" ? "high" : "medium",
      timestamp: event.timestamp,
      payload: {
        deploymentId: event.deploymentId,
        state: event.state,
        message: event.message,
        metadata: event.metadata ?? {},
      },
      dedupeKey: `deployment:${event.deploymentId}:${event.state}:${event.timestamp}`,
    });
  }
}
