import { randomUUID } from "node:crypto";
import { assertTcxExecutionAuthority } from "@/lib/hoare/runtime/governed-execution-authority";
import { SecretAccessPolicyEngine } from "./secret-access-policy";
import type { SecretAccessOperation } from "./secret-access-policy";
import type { SecretAccessRequest } from "./secret-provider";

export type SecretCapabilityStatus = "active" | "revoked" | "consumed";

export type SecretCapabilityScope = Readonly<Pick<
  SecretAccessRequest,
  | "tenantId"
  | "projectId"
  | "transactionId"
  | "attemptId"
  | "secretId"
  | "agentId"
  | "workloadId"
  | "environment"
  | "operation"
  | "nodeId"
  | "runtimeKind"
  | "secretVersion"
>>;

export type SecretCapabilityRecord = Readonly<{
  capabilityId: string;
  policyId: string;
  scope: SecretCapabilityScope;
  issuedAt: string;
  expiresAt: string;
  status: SecretCapabilityStatus;
}>;

export type SecretCapabilityReference = Readonly<{
  capabilityId: string;
  tenantId: string;
  projectId: string;
  secretId: string;
  operation: SecretAccessOperation;
  expiresAt: string;
}>;

export interface SecretCapabilityStore {
  put(record: SecretCapabilityRecord): Promise<void>;
  get(capabilityId: string): Promise<SecretCapabilityRecord | null>;
  revoke(capabilityId: string): Promise<void>;
  /** Must atomically transition active -> consumed and reject replay. */
  consume(capabilityId: string): Promise<SecretCapabilityRecord>;
}

export class InMemorySecretCapabilityStore implements SecretCapabilityStore {
  private readonly records = new Map<string, SecretCapabilityRecord>();

  async put(record: SecretCapabilityRecord): Promise<void> {
    if (this.records.has(record.capabilityId)) throw new Error("secret_capability_duplicate");
    this.records.set(record.capabilityId, record);
  }

  async get(capabilityId: string): Promise<SecretCapabilityRecord | null> {
    return this.records.get(capabilityId) ?? null;
  }

  async revoke(capabilityId: string): Promise<void> {
    const record = this.records.get(capabilityId);
    if (!record) return;
    this.records.set(capabilityId, Object.freeze({ ...record, status: "revoked" }));
  }

  async consume(capabilityId: string): Promise<SecretCapabilityRecord> {
    const record = this.records.get(capabilityId);
    if (!record) throw new Error("secret_capability_not_found");
    if (record.status !== "active") throw new Error("secret_capability_not_active");
    const consumed = Object.freeze({ ...record, status: "consumed" as const });
    this.records.set(capabilityId, consumed);
    return consumed;
  }
}

const assertNonEmpty = (value: string, error: string): string => {
  const normalized = value.trim();
  if (!normalized) throw new Error(error);
  return normalized;
};

export class SecretCapabilityIssuer {
  constructor(
    private readonly store: SecretCapabilityStore,
    private readonly accessPolicy: SecretAccessPolicyEngine,
    private readonly defaultTtlMs = 30_000,
    private readonly now: () => Date = () => new Date(),
  ) {
    if (!Number.isInteger(defaultTtlMs) || defaultTtlMs <= 0 || defaultTtlMs > 300_000) {
      throw new Error("secret_capability_ttl_invalid");
    }
  }

  async issue(
    request: SecretAccessRequest,
    ttlMs = this.defaultTtlMs,
  ): Promise<SecretCapabilityReference> {
    assertTcxExecutionAuthority(request.authority);
    request.authority.assertValid();
    if (!Number.isInteger(ttlMs) || ttlMs <= 0 || ttlMs > 300_000) {
      throw new Error("secret_capability_ttl_invalid");
    }

    const decision = this.accessPolicy.authorize(request);
    request.authority.assertValid();

    const issuedAt = this.now();
    const expiresAt = new Date(issuedAt.getTime() + ttlMs);
    const capabilityId = randomUUID();
    const scope: SecretCapabilityScope = Object.freeze({
      tenantId: request.tenantId,
      projectId: request.projectId,
      transactionId: request.transactionId,
      attemptId: request.attemptId,
      secretId: request.secretId,
      agentId: request.agentId,
      workloadId: request.workloadId,
      environment: request.environment,
      operation: request.operation,
      nodeId: request.nodeId,
      runtimeKind: request.runtimeKind,
      secretVersion: request.secretVersion,
    });

    const record: SecretCapabilityRecord = Object.freeze({
      capabilityId,
      policyId: decision.policyId,
      scope,
      issuedAt: issuedAt.toISOString(),
      expiresAt: expiresAt.toISOString(),
      status: "active",
    });

    await this.store.put(record);
    request.authority.assertValid();

    return Object.freeze({
      capabilityId,
      tenantId: request.tenantId,
      projectId: request.projectId,
      secretId: request.secretId,
      operation: request.operation,
      expiresAt: record.expiresAt,
    });
  }
}

export type SecretCapabilityValidation = Readonly<{
  record: SecretCapabilityRecord;
  request: SecretAccessRequest;
}>;

export class SecretCapabilityValidator {
  constructor(
    private readonly store: SecretCapabilityStore,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async validate(
    reference: SecretCapabilityReference,
    request: SecretAccessRequest,
  ): Promise<SecretCapabilityValidation> {
    assertTcxExecutionAuthority(request.authority);
    request.authority.assertValid();

    if (reference.capabilityId.trim() === "") throw new Error("secret_capability_reference_required");
    if (reference.tenantId !== request.tenantId) throw new Error("secret_capability_reference_tenant_mismatch");
    if (reference.projectId !== request.projectId) throw new Error("secret_capability_reference_project_mismatch");
    if (reference.secretId !== request.secretId) throw new Error("secret_capability_reference_secret_mismatch");
    if (reference.operation !== request.operation) throw new Error("secret_capability_reference_operation_mismatch");

    const record = await this.store.get(reference.capabilityId);
    if (!record) throw new Error("secret_capability_not_found");
    if (record.status !== "active") throw new Error("secret_capability_not_active");
    if (Date.parse(record.expiresAt) <= this.now().getTime()) {
      await this.store.revoke(record.capabilityId);
      throw new Error("secret_capability_expired");
    }
    if (record.expiresAt !== reference.expiresAt) throw new Error("secret_capability_reference_expiry_mismatch");

    const scope = record.scope;
    const pairs: Array<[string, string, string]> = [
      [scope.tenantId, request.tenantId, "secret_capability_tenant_mismatch"],
      [scope.projectId, request.projectId, "secret_capability_project_mismatch"],
      [scope.transactionId, request.transactionId, "secret_capability_transaction_mismatch"],
      [scope.attemptId, request.attemptId, "secret_capability_attempt_mismatch"],
      [scope.secretId, request.secretId, "secret_capability_secret_mismatch"],
      [scope.agentId, request.agentId, "secret_capability_agent_mismatch"],
      [scope.workloadId, request.workloadId, "secret_capability_workload_mismatch"],
      [scope.environment, request.environment, "secret_capability_environment_mismatch"],
      [scope.operation, request.operation, "secret_capability_operation_mismatch"],
    ];
    for (const [expected, actual, error] of pairs) {
      if (expected !== actual) throw new Error(error);
    }
    if (scope.nodeId !== request.nodeId) throw new Error("secret_capability_node_mismatch");
    if (scope.runtimeKind !== request.runtimeKind) throw new Error("secret_capability_runtime_mismatch");
    if (scope.secretVersion !== request.secretVersion) throw new Error("secret_capability_version_mismatch");

    request.authority.assertValid();
    const consumed = await this.store.consume(record.capabilityId);
    request.authority.assertValid();
    return Object.freeze({ record: consumed, request });
  }
}
