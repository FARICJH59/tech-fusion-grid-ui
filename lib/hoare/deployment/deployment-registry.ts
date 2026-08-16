import { runtimeStateStore, type RuntimeRecord } from "@/lib/enterprise/runtime-state";

export type DeploymentStatus = "planned" | "building" | "ready" | "running" | "stopped" | "failed";

export type DeploymentTarget = "frontend" | "backend" | "worker" | "full-stack";

export type DeploymentRecord = {
  id: string;
  tenantId: string;
  projectId: string;
  name: string;
  target: DeploymentTarget;
  status: DeploymentStatus;
  version: string;
  region: string;
  frontendEndpoint?: string;
  backendEndpoint?: string;
  sourceRef?: string;
  manifest?: Record<string, unknown>;
  error?: string;
  createdAt: string;
  updatedAt: string;
};

const ENTITY = "deployments" as const;

function toRuntimeRecord(record: DeploymentRecord): RuntimeRecord {
  return {
    id: record.id,
    tenant_id: record.tenantId,
    payload: record as unknown as Record<string, unknown>,
    created_at: record.createdAt,
    updated_at: record.updatedAt,
  };
}

function fromRuntimeRecord(record: RuntimeRecord): DeploymentRecord {
  const payload = record.payload as Partial<DeploymentRecord>;
  return {
    id: record.id,
    tenantId: record.tenant_id,
    name: String(payload.name ?? record.id),
    projectId: String(payload.projectId ?? ""),
    target: (payload.target as DeploymentTarget) ?? "full-stack",
    status: (payload.status as DeploymentStatus) ?? "planned",
    version: String(payload.version ?? "v1"),
    region: String(payload.region ?? "local"),
    frontendEndpoint: payload.frontendEndpoint,
    backendEndpoint: payload.backendEndpoint,
    sourceRef: payload.sourceRef,
    manifest: payload.manifest,
    error: payload.error,
    createdAt: String(payload.createdAt ?? record.created_at ?? new Date(0).toISOString()),
    updatedAt: String(payload.updatedAt ?? record.updated_at ?? new Date(0).toISOString()),
  };
}

export class DeploymentRegistry {
  async create(input: Omit<DeploymentRecord, "createdAt" | "updatedAt">): Promise<DeploymentRecord> {
    const now = new Date().toISOString();
    const record: DeploymentRecord = { ...input, createdAt: now, updatedAt: now };
    await runtimeStateStore.save(ENTITY, toRuntimeRecord(record));
    return record;
  }

  async update(
    tenantId: string,
    id: string,
    patch: Partial<Omit<DeploymentRecord, "id" | "tenantId" | "createdAt">>,
  ): Promise<DeploymentRecord> {
    const current = (await this.list(tenantId)).find((item) => item.id === id);
    if (!current) throw new Error(`Deployment ${id} not found`);
    const record: DeploymentRecord = {
      ...current,
      ...patch,
      updatedAt: new Date().toISOString(),
    };
    await runtimeStateStore.save(ENTITY, toRuntimeRecord(record));
    return record;
  }

  async get(tenantId: string, id: string): Promise<DeploymentRecord | null> {
    return (await this.list(tenantId)).find((item) => item.id === id) ?? null;
  }

  async list(tenantId: string): Promise<DeploymentRecord[]> {
    const records = await runtimeStateStore.list(ENTITY, tenantId);
    return records.map(fromRuntimeRecord);
  }
}

export const deploymentRegistry = new DeploymentRegistry();
