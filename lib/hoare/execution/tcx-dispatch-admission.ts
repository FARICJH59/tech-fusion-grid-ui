import type { ExecutionDispatchEnvelope } from "./dispatch-envelope";
import { parseExecutionDispatchEnvelope } from "./dispatch-envelope";
import type { ExecutionTransaction } from "./transaction";
import type { ExecutionTransactionRepository } from "./transaction-repository";
import {
  buildTcxDispatchKey,
  requireValidTcxLease,
  type TcxDispatchIntentRepository,
  type TcxLeaseRepository,
} from "./tcx-dispatch-governance";

export type TcxDispatchAdmissionResult = {
  transaction: ExecutionTransaction;
  duplicate: boolean;
};

export type TcxDispatchAdmissionDependencies = {
  transactions: ExecutionTransactionRepository;
  dispatchIntents: TcxDispatchIntentRepository;
  leases: TcxLeaseRepository;
};

function assertEqual(label: string, actual: unknown, expected: unknown): void {
  if (actual !== expected) {
    throw new Error(`tcx_dispatch_${label}_mismatch`);
  }
}

function assertEnvelopeMatchesTransaction(
  envelope: ExecutionDispatchEnvelope,
  transaction: ExecutionTransaction,
): void {
  assertEqual("transaction_id", envelope.transactionId, transaction.transactionId);
  assertEqual("attempt_id", envelope.attemptId, transaction.attemptId);
  assertEqual("attempt_number", envelope.attemptNumber, transaction.attemptNumber);
  assertEqual("idempotency_key", envelope.idempotencyKey, transaction.idempotencyKey);
  assertEqual("tenant_id", envelope.tenantId, transaction.tenantId);
  assertEqual("project_id", envelope.projectId, transaction.projectId);
  assertEqual("workload_id", envelope.workloadId, transaction.workloadId);
  assertEqual("agent_id", envelope.agentId, transaction.agentId);
  assertEqual("node_id", envelope.nodeId, transaction.nodeId);
  assertEqual("pack_id", envelope.packId, transaction.packId);
  assertEqual("runtime_kind", envelope.runtimeKind, transaction.runtimeKind);
  assertEqual("release_digest", envelope.releaseDigest, transaction.releaseDigest);
  assertEqual("artifact_digest", envelope.artifactDigest, transaction.artifactDigest);
  assertEqual("artifact_ref", envelope.artifactRef, transaction.artifactRef);
  assertEqual("pasor_plan_hash", envelope.pasorPlanHash, transaction.pasorPlanHash);
  assertEqual("pasor_unit_id", envelope.pasorUnitId, transaction.pasorUnitId);

  if (envelope.organizationId !== undefined) assertEqual("organization_id", envelope.organizationId, transaction.organizationId);
  if (envelope.missionId !== undefined) assertEqual("mission_id", envelope.missionId, transaction.missionId);
  if (envelope.verticalId !== undefined) assertEqual("vertical_id", envelope.verticalId, transaction.verticalId);
  if (envelope.profileId !== undefined) assertEqual("profile_id", envelope.profileId, transaction.profileId);
  if (envelope.channelId !== undefined) assertEqual("channel_id", envelope.channelId, transaction.channelId);
  if (envelope.leaseId !== undefined) assertEqual("lease_id", envelope.leaseId, transaction.leaseId);
  if (envelope.simulationHash !== undefined) assertEqual("simulation_hash", envelope.simulationHash, transaction.simulationHash);
  if (envelope.provenanceHash !== undefined) assertEqual("provenance_hash", envelope.provenanceHash, transaction.provenanceHash);
  if (envelope.preconditionHash !== undefined) {
    assertEqual("precondition_hash", envelope.preconditionHash, transaction.preconditionHash);
  }
}

/**
 * Receiver-side TCX admission gate.
 *
 * The dispatch envelope records the pre-dispatch state version. The dispatcher
 * then advances AUTHORIZED -> DISPATCHED, so the durable transaction must be
 * exactly one version newer at admission. The durable dispatch intent is the
 * source of truth for the envelope's captured version.
 */
export async function admitTcxDispatch(
  rawEnvelope: unknown,
  dependencies: TcxDispatchAdmissionDependencies,
  now = new Date(),
): Promise<TcxDispatchAdmissionResult> {
  const envelope = parseExecutionDispatchEnvelope(rawEnvelope);
  const transaction = await dependencies.transactions.get(envelope.transactionId);
  if (!transaction) throw new Error("tcx_dispatch_transaction_not_found");

  // Duplicate delivery after admission/execution is a no-op. It must never
  // re-enter execution merely because the same MQTT message was replayed.
  if (transaction.state !== "DISPATCHED") {
    if (
      transaction.attemptId === envelope.attemptId &&
      transaction.idempotencyKey === envelope.idempotencyKey &&
      ["ADMITTED", "RUNNING", "SUCCEEDED"].includes(transaction.state)
    ) {
      return { transaction, duplicate: true };
    }
    throw new Error("tcx_dispatch_state_not_admissible");
  }

  assertEnvelopeMatchesTransaction(envelope, transaction);

  const dispatchKey = buildTcxDispatchKey(envelope.transactionId, envelope.attemptId);
  const intent = await dependencies.dispatchIntents.get(dispatchKey);
  if (!intent) throw new Error("tcx_dispatch_intent_not_found");
  assertEqual("intent_transaction_id", intent.transactionId, transaction.transactionId);
  assertEqual("intent_attempt_id", intent.attemptId, transaction.attemptId);
  assertEqual("intent_attempt_number", intent.attemptNumber, transaction.attemptNumber);
  assertEqual("intent_idempotency_key", intent.idempotencyKey, transaction.idempotencyKey);
  assertEqual("intent_state_version", intent.stateVersion, envelope.stateVersion);
  if (envelope.channelId !== undefined) assertEqual("intent_channel_id", intent.channelId, envelope.channelId);

  if (intent.status === "PENDING") {
    throw new Error("tcx_dispatch_intent_not_claimed");
  }
  if (intent.status !== "CLAIMED" && intent.status !== "PUBLISHED") {
    throw new Error("tcx_dispatch_intent_invalid_status");
  }

  await requireValidTcxLease(transaction, dependencies.leases, now);

  // A dispatcher-created envelope captures the version immediately before
  // AUTHORIZED -> DISPATCHED. Any intervening mutation therefore fences it.
  if (transaction.stateVersion !== envelope.stateVersion + 1) {
    throw new Error("tcx_dispatch_state_version_mismatch");
  }
  if (
    envelope.expectedStateVersion !== undefined &&
    envelope.expectedStateVersion !== envelope.stateVersion
  ) {
    throw new Error("tcx_dispatch_expected_state_version_mismatch");
  }

  const admitted = await dependencies.transactions.transition(
    transaction.transactionId,
    "DISPATCHED",
    "ADMITTED",
    transaction.stateVersion,
  );

  return { transaction: admitted, duplicate: false };
}
