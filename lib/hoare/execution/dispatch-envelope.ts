import type { ExecutionTransaction } from "./transaction";

export const EXECUTION_DISPATCH_SCHEMA = "hoare.execution-dispatch/v1" as const;

export type ExecutionDispatchEnvelope = {
  schema: typeof EXECUTION_DISPATCH_SCHEMA;
  transactionId: string;
  attemptId: string;
  attemptNumber: number;
  idempotencyKey: string;
  stateVersion: number;
  tenantId: string;
  organizationId?: string;
  projectId: string;
  missionId?: string;
  verticalId?: string;
  profileId?: string;
  workloadId: string;
  agentId: string;
  nodeId: string;
  packId: string;
  runtimeKind: ExecutionTransaction["runtimeKind"];
  releaseDigest: string;
  artifactDigest: string;
  artifactRef: string;
  pasorPlanHash: string;
  pasorUnitId: string;
  channelId?: string;
  leaseId?: string;
  expectedStateVersion?: number;
  preconditionHash?: string;
  deadline?: string;
  simulationHash?: string;
  provenanceHash?: string;
  correlationId: string;
  emittedAt: string;
};

export function buildExecutionDispatchEnvelope(
  transaction: ExecutionTransaction,
  now = new Date().toISOString(),
): ExecutionDispatchEnvelope {
  return {
    schema: EXECUTION_DISPATCH_SCHEMA,
    transactionId: transaction.transactionId,
    attemptId: transaction.attemptId,
    attemptNumber: transaction.attemptNumber,
    idempotencyKey: transaction.idempotencyKey,
    stateVersion: transaction.stateVersion,
    tenantId: transaction.tenantId,
    ...(transaction.organizationId ? { organizationId: transaction.organizationId } : {}),
    projectId: transaction.projectId,
    ...(transaction.missionId ? { missionId: transaction.missionId } : {}),
    ...(transaction.verticalId ? { verticalId: transaction.verticalId } : {}),
    ...(transaction.profileId ? { profileId: transaction.profileId } : {}),
    workloadId: transaction.workloadId,
    agentId: transaction.agentId,
    nodeId: transaction.nodeId,
    packId: transaction.packId,
    runtimeKind: transaction.runtimeKind,
    releaseDigest: transaction.releaseDigest,
    artifactDigest: transaction.artifactDigest,
    artifactRef: transaction.artifactRef,
    pasorPlanHash: transaction.pasorPlanHash,
    pasorUnitId: transaction.pasorUnitId,
    ...(transaction.channelId ? { channelId: transaction.channelId } : {}),
    ...(transaction.leaseId ? { leaseId: transaction.leaseId } : {}),
    ...(transaction.expectedStateVersion !== undefined ? { expectedStateVersion: transaction.expectedStateVersion } : {}),
    ...(transaction.preconditionHash ? { preconditionHash: transaction.preconditionHash } : {}),
    ...(transaction.deadline ? { deadline: transaction.deadline } : {}),
    ...(transaction.simulationHash ? { simulationHash: transaction.simulationHash } : {}),
    ...(transaction.provenanceHash ? { provenanceHash: transaction.provenanceHash } : {}),
    correlationId: transaction.transactionId,
    emittedAt: now,
  };
}

export function parseExecutionDispatchEnvelope(
  value: unknown,
): ExecutionDispatchEnvelope {
  if (!value || typeof value !== "object") {
    throw new Error("invalid_execution_dispatch_envelope");
  }

  const envelope = value as Partial<ExecutionDispatchEnvelope>;
  const required = [
    "transactionId",
    "attemptId",
    "idempotencyKey",
    "tenantId",
    "projectId",
    "workloadId",
    "agentId",
    "nodeId",
    "packId",
    "releaseDigest",
    "artifactDigest",
    "artifactRef",
    "pasorPlanHash",
    "pasorUnitId",
    "correlationId",
    "emittedAt",
  ] as const;

  if (
    envelope.schema !== EXECUTION_DISPATCH_SCHEMA ||
    required.some((key) => typeof envelope[key] !== "string" || envelope[key]?.length === 0) ||
    !Number.isInteger(envelope.attemptNumber) || envelope.attemptNumber! < 1 ||
    !Number.isInteger(envelope.stateVersion) || envelope.stateVersion! < 1 ||
    (envelope.expectedStateVersion !== undefined &&
      (!Number.isInteger(envelope.expectedStateVersion) || envelope.expectedStateVersion < 1)) ||
    (envelope.runtimeKind !== "python" && envelope.runtimeKind !== "native")
  ) {
    throw new Error("invalid_execution_dispatch_envelope");
  }

  return envelope as ExecutionDispatchEnvelope;
}
