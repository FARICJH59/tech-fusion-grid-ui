import type {
  DeploymentEvent,
  DeploymentLifecycleState,
  DeploymentRecord,
} from "@/lib/cloud/cloud-types";
import { supabase } from "@/lib/supabase";

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
    this.store.events.push({
      deploymentId,
      state,
      message,
      metadata,
      timestamp: new Date().toISOString(),
    });
  }

  private async persist(record: DeploymentRecord): Promise<void> {
    try {
      await supabase.from("phase8_deployments").upsert({
        id: record.id,
        tenant_id: record.tenantId,
        service: record.service,
        region: record.region,
        status: record.status,
        payload: record,
        updated_at: record.updatedAt,
      });
    } catch {
      // Best-effort persistence in non-configured environments.
    }
  }
}
