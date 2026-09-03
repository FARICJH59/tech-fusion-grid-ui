export const EXECUTION_EVIDENCE_SCHEMA = "hoare.execution-evidence/v1" as const;

export type ExecutionEvidenceStatus =
  | "SUCCEEDED"
  | "FAILED"
  | "TIMEOUT"
  | "REJECTED";

export type ExecutionEvidenceEnvelope = {
  schema: typeof EXECUTION_EVIDENCE_SCHEMA;
  transactionId: string;
  attemptId: string;
  tenantId: string;
  nodeId: string;
  receiptId: string;
  receiptHash: string;
  resultId: string;
  resultHash: string;
  attestationId: string;
  attestationHash: string;
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

  return {
    schema: EXECUTION_EVIDENCE_SCHEMA,
    transactionId: requiredString(input.transactionId, "transactionId"),
    attemptId: requiredString(input.attemptId, "attemptId"),
    tenantId: requiredString(input.tenantId, "tenantId"),
    nodeId: requiredString(input.nodeId, "nodeId"),
    receiptId: requiredString(input.receiptId, "receiptId"),
    receiptHash: requiredString(input.receiptHash, "receiptHash"),
    resultId: requiredString(input.resultId, "resultId"),
    resultHash: requiredString(input.resultHash, "resultHash"),
    attestationId: requiredString(input.attestationId, "attestationId"),
    attestationHash: requiredString(input.attestationHash, "attestationHash"),
    status: status as ExecutionEvidenceStatus,
    correlationId: requiredString(input.correlationId, "correlationId"),
    emittedAt: requiredString(input.emittedAt, "emittedAt"),
  };
}
