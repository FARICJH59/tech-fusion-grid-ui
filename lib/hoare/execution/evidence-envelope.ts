export const EXECUTION_EVIDENCE_SCHEMA = "hoare.execution-evidence/v1" as const;

export type ExecutionEvidenceStatus =
  | "SUCCEEDED"
  | "FAILED"
  | "TIMEOUT"
  | "REJECTED";

export type ExecutionEvidencePayload = Record<string, unknown>;

export type ExecutionEvidenceEnvelope = {
  schema: typeof EXECUTION_EVIDENCE_SCHEMA;
  transactionId: string;
  attemptId: string;
  tenantId: string;
  nodeId: string;
  stateVersion?: number;
  preconditionHash?: string;
  receipt: ExecutionEvidencePayload;
  result: ExecutionEvidencePayload;
  attestation: ExecutionEvidencePayload;
  status: ExecutionEvidenceStatus;
  correlationId: string;
  emittedAt: string;
};

function requiredString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`invalid_execution_evidence:${field}`);
  }
  return value;
}

function requiredObject(value: unknown, field: string): ExecutionEvidencePayload {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`invalid_execution_evidence:${field}`);
  }
  return value as ExecutionEvidencePayload;
}

export function parseExecutionEvidenceEnvelope(
  value: unknown,
): ExecutionEvidenceEnvelope {
  if (!value || typeof value !== "object") {
    throw new Error("invalid_execution_evidence:object");
  }

  const input = value as Record<string, unknown>;
  if (input.schema !== EXECUTION_EVIDENCE_SCHEMA) {
    throw new Error("invalid_execution_evidence:schema");
  }

  const status = input.status;
  if (
    status !== "SUCCEEDED" &&
    status !== "FAILED" &&
    status !== "TIMEOUT" &&
    status !== "REJECTED"
  ) {
    throw new Error("invalid_execution_evidence:status");
  }

  if (
    input.stateVersion !== undefined &&
    (!Number.isInteger(input.stateVersion) || input.stateVersion < 1)
  ) {
    throw new Error("invalid_execution_evidence:stateVersion");
  }
  if (input.preconditionHash !== undefined && typeof input.preconditionHash !== "string") {
    throw new Error("invalid_execution_evidence:preconditionHash");
  }

  return {
    schema: EXECUTION_EVIDENCE_SCHEMA,
    transactionId: requiredString(input.transactionId, "transactionId"),
    attemptId: requiredString(input.attemptId, "attemptId"),
    tenantId: requiredString(input.tenantId, "tenantId"),
    nodeId: requiredString(input.nodeId, "nodeId"),
    ...(input.stateVersion !== undefined ? { stateVersion: input.stateVersion as number } : {}),
    ...(input.preconditionHash !== undefined ? { preconditionHash: input.preconditionHash } : {}),
    receipt: requiredObject(input.receipt, "receipt"),
    result: requiredObject(input.result, "result"),
    attestation: requiredObject(input.attestation, "attestation"),
    status: status as ExecutionEvidenceStatus,
    correlationId: requiredString(input.correlationId, "correlationId"),
    emittedAt: requiredString(input.emittedAt, "emittedAt"),
  };
}
