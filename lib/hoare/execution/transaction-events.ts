import { randomUUID } from "node:crypto";
import type { AutonomousEvent, AutonomousEventType } from "@/lib/events/event-types";
import type { ExecutionTransaction } from "./transaction";

export type ExecutionTransactionEventPayload = {
  transactionId: string;
  stateVersion: number;
  tenantId: string;
  organizationId?: string;
  projectId: string;
  missionId?: string;
  verticalId?: string;
  profileId?: string;
  attemptId: string;
  attemptNumber: number;
  releaseDigest: string;
  artifactDigest: string;
  artifactRef: string;
  pasorPlanHash: string;
  pasorUnitId: string;
  workloadId: string;
  agentId: string;
  nodeId: string;
  packId: string;
  runtimeKind: ExecutionTransaction["runtimeKind"];
  channelId?: string;
  leaseId?: string;
  expectedStateVersion?: number;
  preconditionHash?: string;
  deadline?: string;
  simulationHash?: string;
  provenanceHash?: string;
  receiptId?: string;
  resultId?: string;
  attestationId?: string;
};

const EVENT_TYPES = new Set<AutonomousEventType>([
  "execution-transaction-created",
  "execution-transaction-authorized",
  "execution-transaction-dispatched",
  "execution-transaction-admitted",
  "execution-transaction-started",
  "execution-transaction-completed",
  "execution-transaction-failed",
  "execution-transaction-timeout",
  "execution-transaction-repair-requested",
  "execution-transaction-retry-requested",
  "execution-transaction-cancelled",
]);

export function toExecutionTransactionEventPayload(
  transaction: ExecutionTransaction,
): ExecutionTransactionEventPayload {
  return {
    transactionId: transaction.transactionId,
    stateVersion: transaction.stateVersion,
    tenantId: transaction.tenantId,
    ...(transaction.organizationId ? { organizationId: transaction.organizationId } : {}),
    projectId: transaction.projectId,
    ...(transaction.missionId ? { missionId: transaction.missionId } : {}),
    ...(transaction.verticalId ? { verticalId: transaction.verticalId } : {}),
    ...(transaction.profileId ? { profileId: transaction.profileId } : {}),
    attemptId: transaction.attemptId,
    attemptNumber: transaction.attemptNumber,
    releaseDigest: transaction.releaseDigest,
    artifactDigest: transaction.artifactDigest,
    artifactRef: transaction.artifactRef,
    pasorPlanHash: transaction.pasorPlanHash,
    pasorUnitId: transaction.pasorUnitId,
    workloadId: transaction.workloadId,
    agentId: transaction.agentId,
    nodeId: transaction.nodeId,
    packId: transaction.packId,
    runtimeKind: transaction.runtimeKind,
    ...(transaction.channelId ? { channelId: transaction.channelId } : {}),
    ...(transaction.leaseId ? { leaseId: transaction.leaseId } : {}),
    ...(transaction.expectedStateVersion !== undefined ? { expectedStateVersion: transaction.expectedStateVersion } : {}),
    ...(transaction.preconditionHash ? { preconditionHash: transaction.preconditionHash } : {}),
    ...(transaction.deadline ? { deadline: transaction.deadline } : {}),
    ...(transaction.simulationHash ? { simulationHash: transaction.simulationHash } : {}),
    ...(transaction.provenanceHash ? { provenanceHash: transaction.provenanceHash } : {}),
    ...(transaction.receiptId ? { receiptId: transaction.receiptId } : {}),
    ...(transaction.resultId ? { resultId: transaction.resultId } : {}),
    ...(transaction.attestationId ? { attestationId: transaction.attestationId } : {}),
  };
}

export function isExecutionTransactionEventType(
  type: AutonomousEventType,
): boolean {
  return EVENT_TYPES.has(type);
}

export function buildExecutionTransactionEvent(
  transaction: ExecutionTransaction,
  type: AutonomousEventType,
  priority: AutonomousEvent["priority"] = "high",
): AutonomousEvent<ExecutionTransactionEventPayload> {
  if (!isExecutionTransactionEventType(type)) {
    throw new Error("invalid_execution_transaction_event_type");
  }

  return {
    id: randomUUID(),
    tenantId: transaction.tenantId,
    organizationId: transaction.organizationId ?? transaction.tenantId,
    type,
    source: "hoare.execution.transaction-coordinator",
    priority,
    timestamp: new Date().toISOString(),
    correlationId: transaction.transactionId,
    dedupeKey: `${transaction.idempotencyKey}:${type}`,
    payload: toExecutionTransactionEventPayload(transaction),
  };
}
